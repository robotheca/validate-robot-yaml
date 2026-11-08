# Validate robotheca.yaml

A GitHub Action that checks a repository's `robotheca.yaml` against the
[robotheca.yaml standard](https://robotheca.org/robotheca-yaml/spec) of
Robotheca, the library of open robots you can rebuild. Each problem
appears as an annotation on the line it concerns. It runs free in public
repositories.

`robot.yaml`, the file's first name, is checked the same way.

## Use

Add `.github/workflows/robotheca-yaml.yml` to your robot's repository:

```yaml
name: robotheca.yaml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: robotheca/validate-robot-yaml@v1
        # with:
        #   path: hardware/robotheca.yaml
```

Without `path`, it looks for `robotheca.yaml`, then `robot.yaml`, at the
root of the repository.

## What it checks

Everything the schema says, for the version the file names in
`format_version`: version 1.0 (`robotheca.schema.json`) or version 0.1
(`robot.schema.json`). The required fields (`format_version`, `name`,
`summary`, `category`, `difficulty`, `license`, `source`), their types
and allowed values, no unknown fields, and in 1.0 that a cost range's
high end is not below its low end. The schemas are copies of Robotheca's
`spec/robotheca.schema.json` and `spec/robot.schema.json`, the ones
robotheca.org uses when it imports a robot. You can also check a file in
your browser: https://robotheca.org/robotheca-yaml/check.

robotheca.org also refuses, for safety, files over 64 KB, more than 50
YAML aliases and nesting deeper than 32 levels; a normal file is far from
these limits, and this Action does not check them.

## License

Apache-2.0 (see `LICENSE`), including the copies of the schemas. The
specification's text is under CC BY 4.0.

## Status

Version 1.2 (`v1.2.0`), 8 November 2026: robotheca.yaml 1.0 and both
file names. Version 1.1 (`v1.1.0`), 4 November 2026: "hexapod" as a
category. Version 1, 23 October 2026: robot.yaml 0.1. `v1` follows the
newest 1.x; files that passed an earlier version still pass.
