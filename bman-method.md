# B-MAN Method

**Human-in-control AI-assisted software development.**

The B-MAN Method is a practical workflow for using LLMs in real production codebases  
*without* giving up control, clarity, or accountability.

It is **not** about replacing engineers.  
It is about using AI as a **disciplined execution tool** under strict human guidance.

---

## The Problem

Current AI development approaches tend to fail in one of two ways:

1. **Over-autonomous agents**  
   - Hard to trust  
   - Hard to review  
   - Hard to debug  
   - Create large, opaque diffs  

2. **Interactive AI usage**  
   - Interrupts focus  
   - Encourages micro-iterations  
   - Creates cognitive fatigue  
   - Scales poorly across teams  

Both approaches reduce engineering quality over time.

---

## The B-MAN Idea

> **You define the work.  
> The AI executes inside boundaries.  
> Humans review with full context.**

B-MAN is based on a simple inversion:

- AI does **implementation**, not ownership
- Humans do **design, boundaries, and final judgment**
- Every unit of work is small, reviewable, and explainable

---

## Core Principles

### 1. One Task → One Commit
AI works on **exactly one task per run**.  
No batching. No “while I’m here” changes.

### 2. Explicit Boundaries
Each task defines:
- What must be done
- What must not be touched
- What “done” means

AI operates *only* inside those boundaries.

### 3. Explain Every Change
Every AI commit includes **AI Thoughts**:
- Assumptions
- Decisions
- Uncertainties
- Trade-offs

This makes reviews faster, safer, and more accurate.

### 4. Human Review Is Mandatory
AI output is never trusted blindly.
Review is easier — not optional.

### 5. Abort Is a Feature
If something feels off:
- Reset
- Refine the task
- Re-run

No sunk-cost fallacy.

---

## Typical Workflow

1. Human writes a short task list
2. Each task includes a lightweight Definition of Done
3. AI executes tasks **one by one**
4. Each task produces:
   - A single commit
   - Clear rationale in the commit body
5. Human reviews, adjusts, or aborts
6. Only clean commits move forward

---

## What This Enables

- Predictable AI behavior
- Clean Git history
- Fast, high-quality reviews
- Safer use of LLMs in production
- Reduced cognitive load
- Scalable team adoption

---

## What This Is *Not*

- Not autonomous agents
- Not “AI replaces engineers”
- Not large speculative refactors
- Not prompt-engineering gymnastics

---

## Reference Implementations

TBD

---

## Philosophy

> **AI should accelerate engineering — not obscure it.**  
> **Control beats cleverness.**  
> **Transparency beats autonomy.**

---

## Status

This methodology is actively evolving based on real production use.

Contributions, discussions, and experiments are welcome.

---

## License

Open by design.  
Use it, fork it, adapt it — responsibly.