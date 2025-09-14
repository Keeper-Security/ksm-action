![Keeper Security Secrets Manager GitHub Action Header](https://github.com/user-attachments/assets/e770c6fe-66be-4384-81c3-24814678e225)

# Keeper Secrets Manager : GitHub Action

Keeper’s GitHub Actions integration lets DevOps and engineering teams securely pull secrets from Keeper Secrets Manager directly into their CI/CD workflows. By using the ksm-action in a GitHub Actions pipeline, you can fetch credentials, API keys, or files stored in Keeper and inject them as environment variables, workflow outputs, or files on the runner—while keeping them masked from logs. The setup requires a configured Secrets Manager application and a Keeper configuration file stored as a GitHub secret, making it easy to centralize secret management and eliminate hardcoded credentials in pipelines.

## Features

- Retrieve secrets from the Keeper Vault within the Github Actions runner
- Set secret credentials as build arguments or environment variables in Github Actions scripts
- Copy secure files from the Keeper Vault

## Get Started

- See our [official documentation page](https://docs.keeper.io/en/keeperpam/secrets-manager/integrations/github-actions) for GitHub Actions
- Learn more about [Keeper Secrets Manager](https://docs.keeper.io/en/keeperpam/secrets-manager/overview)
- Learn more about [KeeperPAM](https://docs.keeper.io/en/keeperpam)
