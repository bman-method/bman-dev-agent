- [x] TASK-1: Support custom agent:
* Allow executing the cli with --agent custom
* In case that the config file contains the entry "customAgentCmd" and the cli was requested to run with --agent custom, instead of executing codex, execute the custom command. If the entry is not there, fail with error that explains how to configure the custom agent cmd.
* Add an optional field to the config file: defaultAgent. Possible values: codex, custom.
This will set what is the default agent to use when no --agent is specified to the CLI (currently its hard coded to codex)
* The technical part of this task probably makes sense to rename the class CodexAgent to CLIAgent (or similar) and inject the command to it.

- [x] TASK-2: Allow command line arguments for custom agent
* The customAgentCmd config property should support values such as (example):
```
{
"customAgentCmd": "my-agent arg1 arg2 arg3"
}
```
In this case, you should use "my-agent" as the command and provide it arg1..3 as arguments. It makes sense to suppot this because users may need to set custom permissions and various flags to their custom agents.
