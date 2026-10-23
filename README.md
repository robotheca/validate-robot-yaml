# Validate robot.yaml

A GitHub Action that checks a repository's `robot.yaml` against the
[robot.yaml standard](https://robotheca.org) of Robotheca, the library of
open robots you can rebuild. Each problem appears as an annotation on the
line of `robot.yaml` it concerns. It runs free in public repositories.

## Use

Add `.github/workflows/robot-yaml.yml` to your robot's repository:

```yaml
name: robot.yaml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: robotheca/validate-robot-yaml@v1
        # with:
        #   path: robot.yaml
```

## What it checks

Everything the robot.yaml schema says (version 0.1): the required fields
(`format_version`, `name`, `summary`, `category`, `difficulty`, `license`,
`source`), their types and allowed values, and no unknown fields. The
schema is a copy of Robotheca's `spec/robot.schema.json`, the one
robotheca.org uses when it imports a robot.

robotheca.org also refuses, for safety, files over 64 KB, more than 50
YAML aliases and nesting deeper than 32 levels; a normal robot.yaml is far
from these limits, and this Action does not check them.

## License

Apache-2.0 (see `LICENSE`), including the copy of the robot.yaml schema.

## Status

Version 1 (`v1`), 23 October 2026.
