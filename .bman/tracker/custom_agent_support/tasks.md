- [x] TASK-1: Support custom agent:
* Allow executing the cli with --agent custom
* In case that the config file contains the entry "customAgentCmd" and the cli was requested to run with --agent custom, instead of executing codex, execute the custom command. If the entry is not there, fail with error that explains how to configure the custom agent cmd.
* Add an optional field to the config file: defaultAgent. Possible values: codex, custom.
This will set what is the default agent to use when no --agent is specified to the CLI (currently its hard coded to codex)
* The technical part of this task probably makes sense to rename the class CodexAgent to CLIAgent (or similar) and inject the command to it.
