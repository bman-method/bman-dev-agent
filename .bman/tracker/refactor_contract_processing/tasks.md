Background:
The contract validation is involving 2 main components: outputContract.ts and resultValidator.ts.
Those are tightly coupled. Both should know about all the contract fields and this is annoying. I'd like instead to have OutputContract as a constant schema that the type AgentOutput can be inferred from it. Then, we should have a generic schema validator that can validate the contract.
Here is an example I got from ChatGPT on how it can be done:

```
const agentOutputSchema = {
  taskId: {
    type: "string",
    descriptionOfContent: "The task id provided in the tasks file.",
    required: true,
  },
  commitMessage: {
    type: "string",
    descriptionOfContent: "Full commit message (subject + body); imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
    required: true,
    maxLines: 10,
    maxLen: 500,
  },
  ... all the other fields
} as const;

Then we can use this to infer the type:
```
type FieldDesc =
  | { type: "boolean" }
  | { type: "string" }
  | { type: "string[]" };

type InferField<D extends FieldDesc> =
  D["type"] extends "boolean" ? boolean :
  D["type"] extends "string" ? string :
  D["type"] extends "string[]" ? string[] :
  never;

type InferFromSpec<S extends Record<string, FieldDesc & { required: boolean }>> = {
  [K in keyof S as S[K]["required"] extends true ? K : never]: InferField<S[K]>;
} & {
  [K in keyof S as S[K]["required"] extends false ? K : never]?: InferField<S[K]>;
};

export type AgentOutput = InferFromSpec<typeof agentOutputSchema>;
```

Make sure to run all tests and linter before closing each task.
Non passing tests that you can't fix = blocked task.

- [x] TASK-1: Add generic parsing + validation utility class that can get a schema such as agentOutputSchema and a string (json), then it can validate the object and return an inferred type.
Example usage may be:
```
const validator = new SchemaValidator<AgentOutput>(agentOutputSchema);

try {
const agentOutput = validator.parse(string);
} catch () {
// handle validation errors
}
```

- [ ] TASK-2: Unite ResultReader and ResulValidator into one class. Both are very small, especially the reader.

- [ ] TASK-3: Remove the "(type: string)" from the field description in the schema, and make sure that buildOutputContract adds it properly (for the prompt)
