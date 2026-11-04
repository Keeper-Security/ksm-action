# Local ncc build tool

This package uses the ncc `0.45.0` source. `UPSTREAM.json` identifies the source commit. The `src` files and `LICENSE` come from that commit.

Use `ksm-ncc` through `npm run package`. The CLI uses the installed build dependencies. It generates the source-map helper before each build and includes the helper license notices.

The root project installs a copy of this package with `install-links=true`. Root dependency overrides apply to that copy. Keep the `file:tools/ncc-source` dependency path without `./`.

Direct library calls do not prepare the source-map helper. Set `sourceMapRegister: false` when a library call enables source maps. Use the CLI for source-map helper registration.

Run `npm test -- --runInBand __tests__/ncc-source.test.ts` to check the build tool.
