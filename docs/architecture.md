# Architecture

## System Overview

The PoC consists of three components working together to demonstrate LaunchDarkly's A/B testing capabilities in the context of an iOS streaming app.

```mermaid
graph TB
    subgraph "PoC Components"
        FE["Frontend<br/>(Mock iOS App)"]
        SIM["Traffic Simulator<br/>(Node.js)"]
        SETUP["Setup Script<br/>(REST API)"]
    end

    subgraph "LaunchDarkly Platform"
        FLAGS["Feature Flags"]
        EVAL["Flag Evaluation Engine"]
        EVENTS["Event Pipeline"]
        EXP["Experiments Dashboard"]
        STATS["Statistical Engine<br/>(Bayesian)"]
    end

    SETUP -->|"Creates flags,<br/>metrics, experiments"| FLAGS
    FE -->|"Client-side SDK<br/>(single user)"| EVAL
    SIM -->|"Server-side SDK<br/>(thousands of users)"| EVAL
    EVAL -->|"Assigns variation"| FLAGS
    FE -->|"track() events"| EVENTS
    SIM -->|"track() events"| EVENTS
    EVENTS -->|"Aggregates"| STATS
    STATS -->|"Confidence intervals"| EXP
```

## Data Flow: Single User Session

```mermaid
sequenceDiagram
    participant App as iOS App (Mock)
    participant SDK as LD Client SDK
    participant LD as LaunchDarkly Edge
    participant Exp as Experiments Engine

    App->>SDK: Initialize with device UUID
    SDK->>LD: Establish streaming connection
    LD-->>SDK: Flag state (show-recommendations: true/false)
    SDK-->>App: variation("show-recommendations")

    alt Treatment (show-recommendations = true)
        App->>App: Render recommendations row
    else Control (show-recommendations = false)
        App->>App: Standard UI
    end

    App->>SDK: track("content-clicked")
    SDK->>LD: Event payload (batched)
    LD->>Exp: Aggregate into experiment
    Exp->>Exp: Update Bayesian posterior
```

## Traffic Simulator Flow

```mermaid
sequenceDiagram
    participant CLI as CLI (run.js)
    participant SIM as Simulator
    participant CTX as Context Factory
    participant SDK as LD Server SDK
    participant LD as LaunchDarkly

    CLI->>SIM: Run scenario (e.g., "win", 2000 users)

    loop Each wave (100 users)
        SIM->>CTX: Create batch of user contexts
        CTX-->>SIM: 100 unique UUIDs + device metadata

        loop Each user in wave
            SIM->>SDK: variation("show-recommendations", context)
            SDK-->>SIM: true or false

            alt Should convert (probabilistic)
                SIM->>SDK: track("content-clicked", context)
            end
        end

        SIM->>SDK: flush()
        SDK->>LD: Batch event payload
        SIM->>SIM: Log progress + stats
        SIM->>SIM: Wait (3s delay for dashboard)
    end

    SIM->>CLI: Final aggregated results
```

## Component Responsibilities

| Component | Role | SDK | Purpose |
|-----------|------|-----|---------|
| `src/setup.js` | Control plane | REST API | Creates flags, metrics, experiments |
| `src/run.js` | Imperative shell | Server SDK | Orchestrates simulation |
| `src/simulator.js` | Core engine | Server SDK | Evaluates flags, sends events |
| `src/scenarios.js` | Pure config | None | Defines probability matrices |
| `frontend/` | Visual demo | Client SDK | Shows flag evaluation in a UI |

## Why Server-Side SDK for Simulation?

The server-side SDK evaluates flags **locally** using an in-memory cache of the flag configuration. This means:

- No network round-trip per evaluation (microseconds, not milliseconds)
- Can handle 10,000+ evaluations per second
- Events are batched and flushed periodically (or on demand)

The client-side SDK, by contrast, evaluates flags on LaunchDarkly's edge network — great for real apps, but too slow for bulk simulation.
