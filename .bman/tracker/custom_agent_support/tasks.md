- [x] TASK-1: Support custom agent:
* Allow executing the cli with --agent custom
* In case that the config file contains the entry "customAgentCmd" and the cli was requested to run with --agent custom, instead of executing codex, execute the custom command. If the entry is not there, fail with error that explains how to configure the custom agent cmd.
* Add an optional field to the config file: defaultAgent. Possible values: codex, custom.
This will set what is the default agent to use when no --agent is specified to the CLI (currently its hard coded to codex)
* The technical part of this task probably makes sense to rename the class CodexAgent to CLIAgent (or similar) and inject the command to it.

- [x] TASK-2: Allow command line arguments for custom agent
* Change the config property customAgentCmd from string to array to allow multiple args for the custom agent command (example):
```
{
"customAgentCmd": ["my-agent","arg1","arg2","arg3"]
}
```
In this case, you should use "my-agent" as the command and provide it arg1..3 as arguments. It makes sense to suppot this because users may need to set custom permissions and various flags to their custom agents.

- [x] TASK-3: Make sure outputPath in the prompt (see promptStrategy.ts) is relative to the folder from which the cli runs (the root source folder)
Some coding agents will refuse to write the file if they'll get a full path.

- [x] TASK-4: I'd like to change the config structure as follows:
Instead of the current
```
{
"customAgentCmd": ["gemini", "-m", "gemini-2.5-flash-lite", "--approval-mode", "auto_edit"],
"defaultAgent": "custom"
}
```

I want it to be like this:
```
{
"agent": {
"default": "gemini-lite",
"registry": {
"gemini-lite": {
"cmd": ["gemini","-m", "gemini-2.5-flash-lite", "--approval-mode", "auto_edit"],
},
"claude": { "cmd": ["claude"] }
}
}
}

```
This also affects the command line args,
Instead of --agent custom, you can use --agent <name> where name must be one of the keys of the registry above. However, we should still have constant defaults for codex, gemini and claude.
codex - the default cmd should be:
```
["codex","exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"]
```
gemini - the default cmd should be:
```
["gemini", "--approval-mode", "auto_edit"]
```
claude - the default cmd should be:
```
["claude", "--allowedTools", "Read,Write,Bash", "--output-format", "json", "-p", "--verbose"]
```

- [x] TASK-5: Encapsulate the command logic inside CLIAgent.
Instead of the cli.ts reading config and constructing the command, move this logic into CLIAgent class and just make the cli pass the agents config to it.
Also the default registry should be moved to the CLIAgent class.
Also fix the usage text to specify the built in agent names (claude / gemini / codex)

- [x] TASK-6: Update readme.md with the agent config changes made in this branch.
The update should include an example of how to configure custom agent entry.

- [x] TASK-7: In task 5 you were requested to encapsulate the agents registry handling in CLIAgent. This was partially done, because I still see that the ConfigLoader is using CLIAgent.defaultRegistry() method. This should not be the case.
CLIAgent should not be dependency of configLoader. Instead, the agent config should be passed to CLIAgent as is, and CLIAgent can make the decisions on how to use the default configs if no config is provided in the file.
* Make sure that the default registry config is merged with the config file's registry.
For instance, if the config file contins only the agent "claude", the user can still use gemini (--agent gemini) and in this case, the cmd line config of gemini will be taken from the default registry.
However, if the config file contains "gemini" in the agents registry - this will be used (not the default)
* Check if you need to update the readme.md

- [x] TASK-8: Update readme.md with the built in agents that we support now (claude, gemini, codex, custom command) and remove the Planned / upcoming support

- [ ] TASK-9: the method resolveAgent need to get out of cli.ts because it doesn't know the built in agents. In order to print agent name, the cli.ts code can get it from the CLIAgent class instance (that may expose the name)
