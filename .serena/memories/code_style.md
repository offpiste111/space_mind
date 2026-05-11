
## Code Style and Conventions

### Linting and Formatting

- No explicit linting or formatting configuration files (e.g., `.eslintrc`, `prettier.config.js`, `ruff.toml`) were found in the project.
- The `package.json` file does not contain any dedicated `lint` or `format` scripts.

### Type Checking

- The frontend build process, triggered by `npm run build`, includes the `tsc` command. This means that **TypeScript type checking is enforced** during the build. All TypeScript code must pass type checks for a production build to succeed.

### Recommendations

- Given the lack of explicit style configurations, developers should **infer the code style from existing files**.
- Pay close attention to the surrounding code and maintain consistency in:
  - Naming conventions for variables, functions, and components.
  - The use and style of type hints in TypeScript.
  - General code structure and organization.
