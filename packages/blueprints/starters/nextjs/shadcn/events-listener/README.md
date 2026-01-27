# Event Listener

Blockchain event listener application for tracking and processing on-chain events in real-time.

## Features

- **Real-time Indexing**: High-performance blockchain indexing powered by [Ponder](https://ponder.sh/).
- **Job Processing**: Reliable background task management with [BullMQ](https://docs.bullmq.io/).
- **Database Integration**: Type-safe database operations using [Drizzle ORM](https://orm.drizzle.team/).
- **Pub/Sub Messaging**: Live updates and inter-service communication via [Redis](https://redis.io/).
- **Web Dashboard**: Clean Next.js interface for monitoring events and notifications.
- **Modular Architecture**: Clean separation of concerns using Domain-Driven Design (Hexagonal architecture).

## Stack

- **Frontend**: Next.js 15
- **Indexer**: Ponder
- **Workers**: BullMQ (Node.js)
- **Database**: Drizzle ORM + PostgreSQL (Neon)
- **Cache**: Redis
- **Web3**: Viem
- **Architecture**: Domain-Driven Design (Hexagonal)

## Getting Started

This template was created with [Kompo](https://kompo.dev).

## Development

To start the web application:

```bash
pnpm dev
```

To start the indexer:

```bash
pnpm --filter "@<%= it.org%>/event-indexer" dev
```

To start the workers:

```bash
pnpm --filter "@<%= it.org%>/event-workers" dev
```

## License

MIT
