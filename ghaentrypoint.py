import json
import os
from enum import Enum
from os import environ
from actions_toolkit import core
from keeper_secrets_manager_core import SecretsManager
from keeper_secrets_manager_core.storage import InMemoryKeyValueStorage


class DestinationKey(Enum):

    ENV = 'env'
    OUT = 'out'
    FILE = 'file'


class RecordActionEntry:

    def __init__(self):
        self.uid = None
        self.field_type = None
        self.field_value = None
        self.destination_type = DestinationKey.ENV
        self.destination_val = None

    @staticmethod
    def from_query_entries(query_entries):
        secrets_entries = query_entries.splitlines()

        raes = []
        for se in secrets_entries:
            raes.append(RecordActionEntry.from_entry(se))

        return raes

    @staticmethod
    def from_entry(record_action_entry_str):

        se_parts = record_action_entry_str.split('|')           # [uid123 field:password], [PASSWORD]

        record_details_str = se_parts[0].strip()                # uid123 password
        record_details_arr = record_details_str.split(" ", 1)   # ['uid123', 'field:password'] OR ['uid321', 'file:config.json']
        record_uid = record_details_arr[0]                      # 'uid123'
        secret_value_location = record_details_arr[1]           # Field to retrieve. ex.
        # 'password' OR
        # 'field:login' OR
        # 'custom:MyField' OR
        # 'file:config.json'

        rae = RecordActionEntry()
        rae.uid = record_uid.strip()

        # 1. Source
        secret_value_location_arr = secret_value_location.split(':')
        if len(secret_value_location_arr) == 1:
            rae.field_type = 'field'
            rae.field_value = secret_value_location_arr[0]
        elif len(secret_value_location_arr) == 2:
            rae.field_type = secret_value_location_arr[0]
            rae.field_value = secret_value_location_arr[1]
        else:
            raise Exception("Source string was not properly formatted. Err #DE1")

        # 2. Destination
        destination_str = se_parts[1].strip()
        destination_arr = destination_str.split(':')

        if len(destination_arr) == 1:
            rae.destination_type = DestinationKey.ENV
            rae.destination_val = destination_arr[0]
        elif len(destination_arr) == 2:
            rae.destination_type = DestinationKey(destination_arr[0])
            rae.destination_val = destination_arr[1]
        else:
            raise Exception("Destination string was not properly formatted. Err #DE2")

        return rae


def find_record(secrets, search_term):

    found_rec = None
    for s in secrets:
        if s.uid == search_term or s.title == search_term:
            found_rec = s

    return found_rec


def __save_to_file(record, rae):
    file_name = rae.field_value                  # ex. 'config.json'

    core.info("Processing file %s" % file_name)
    core.debug("Number of files in secret: %s" % len(record.files))
    file_found = None
    for f in record.files:
        core.debug("Checking file name: \"%s\", file title: \"%s\"" % (f.name, f.title))
        if f.name == file_name or f.title == file_name:
            core.info("Found file '%s'" % file_name)
            if file_found:
                core.warning(
                    "More than two files named %s in record uid=%s. Make sure to have unique names for files." % (
                        file_name, record.uid))
                # TODO Is there a way to get files by their UID? or some other unique identifier?

            file_found = f

    if not file_found:
        core.warning("No files found named \"%s\"" % file_name)
        # core.end_group()
        return

    core.info("Located file %s" % file_name)

    is_file_destination = rae.destination_type == DestinationKey.FILE

    if is_file_destination:
        core.info("File destination: %s" % rae.destination_val)

        file_found.save_file(rae.destination_val, True)
        core.debug("File saved to %s" % rae.destination_val)
    else:
        core.error("Only file destination is currently supported. Ex. file:/path/to/file.json")


def run_action():

    core.info('-= Keeper Secrets Manager GitHub Action =-')

    keeper_hostname = environ.get('KEEPER_HOSTNAME')
    secret_config = environ.get('SECRET_CONFIG')
    secret_query = environ.get('SECRETS')
    verify_ssl_certs = environ.get('VERIFY_SSL_CERTS')
    unmask_secret = environ.get('UNMASK')

    if verify_ssl_certs:
        verify_ssl_certs = verify_ssl_certs.lower() in ['true', '1', 't', 'y', 'yes']
    else:
        verify_ssl_certs = True

    if not secret_config:
        core.set_failed("KSM configuration is empty")

    core.debug('Secret query:%s' % secret_query)

    # 1. Authenticate Secrets Manager instance
    sm = SecretsManager(config=InMemoryKeyValueStorage(secret_config), verify_ssl_certs=verify_ssl_certs)

    if keeper_hostname:
        core.info('Keeper hostname: %s' % keeper_hostname)
        sm.hostname = keeper_hostname

    record_actions = RecordActionEntry.from_query_entries(secret_query)

    # Get only UIDs of the records from the query list
    uids = [r.uid for r in record_actions]

    # Retrieving only secrets that were asked in the action
    retrieved_secrets = sm.get_secrets(uids)

    core.debug("Begin retrieving secrets from Keeper...")
    core.info("Retrieved %s secrets." % len(retrieved_secrets))

    core.debug("Secrets to retrieve: %s" % len(record_actions))

    count = 0
    outputs_map = {}
    env_map = {}

    for record_action in record_actions:

        count += 1

        core.info("Retrieving secret %s: uid=%s" % (str(count), record_action.uid))

        record = find_record(retrieved_secrets, record_action.uid)

        if not record:
            core.warning("Record uid=%s not found. Make sure you have this record added to the application you are "
                         "using." % record_action.uid)
        else:
            core.info("Secret uid=%s, source field type=[%s], source field value=[%s], dest=[%s], dest_key=[%s]" % (
                record.uid,
                record_action.field_type,
                record_action.field_value,
                record_action.destination_type,
                record_action.destination_val))

            secret_value = None

            if record_action.destination_type in [DestinationKey.ENV, DestinationKey.OUT]:
                if record_action.field_value == 'title':
                    secret_value = record.title
                elif record_action.field_type == 'field':
                    secret_value = record.field(record_action.field_value)[0]
                elif record_action.field_type == 'custom':
                    secret_value = record.custom_field(record_action.field_value)[0]
                else:
                    raise Exception("Currently supporting only fields and custom fields in the record. "
                                    "Supplied field name=[%s] with destination type=[%s]" %
                                    (record_action.field_value, record_action.destination_type))

            if record_action.destination_type == DestinationKey.ENV:

                env_map[record_action.destination_val] = secret_value

                if unmask_secret == 'true':
                    core.warning("Secret with destination '%s' will be unmasked" % record_action.destination_val)
                else:
                    core.debug("Masking secrets.")
                    core.set_secret(secret_value)   # hiding any values, even title

            elif record_action.destination_type == DestinationKey.OUT:
                outputs_map[record_action.destination_val] = secret_value

            elif record_action.destination_type == DestinationKey.FILE:
                __save_to_file(record, record_action)
            else:
                raise Exception("Unknown destination type specified: %s" % record_action.destination_type)

    if outputs_map:
        outputs_json = json.dumps(outputs_map)
        core.debug('data=[%s]' % outputs_json)
        core.set_output('data', outputs_json)

    write_to_env(env_map)

    core.info("Finish retrieving secrets from Keeper Security")


def write_to_env(env_map):
    if env_map:
        github_env_file = os.environ.get('GITHUB_ENV')

        env_map_str = ''
        for key, value in env_map.items():
            env_map_str += '%s=%s\n' % (key, value)

        with open(github_env_file, 'a') as github_env_file:
            github_env_file.write(env_map_str)


if __name__ == '__main__':
    run_action()
