# CupidBot Launcher

CupidBot Launcher is a local-first Electron launcher for the CupidBot client. It keeps launcher state in `~/.cupidbot`, launches local `cupidbot-<version>.jar` files, and uses the Jagex account OAuth flow without downloading client jars from project-owned services.

## Prerequisites

- Node.js and npm
- Java 17 or newer for the CupidBot client jar
- A built CupidBot shaded jar from the sibling `cupidbot` checkout

## Installation

```bash
cd cupidbot-launcher
npm install
```

Build CupidBot and install the local launcher jar:

```bash
cd ../cupidbot
JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./gradlew :client:assemble
scripts/install-cupidbot-launcher-jar.sh
```

Run the launcher:

```bash
npm run dev
```

## Local Client Jars

The launcher never downloads a client jar. Put jars in `~/.cupidbot` with the name `cupidbot-<version>.jar`; the install helper uses `cupidbot.version` from `../cupidbot/gradle.properties` by default.

To install a specific jar path while keeping the configured CupidBot version:

```bash
cd ../cupidbot
scripts/install-cupidbot-launcher-jar.sh runelite-client/build/libs/cupidbot-2.6.10.jar
```

## Offline Tips

- If the launcher shows `0.0.0` for the client version, install a local jar into `~/.cupidbot`.
- If Java is missing, install JDK 17 locally and make `java` available on `PATH`.
- Jagex account refresh uses official Jagex endpoints; client jar and plugin installation remain local.

## Mock Authentication Mode

Set `MOCK_AUTH=1` for UI testing. Mock accounts are in-memory only and reset when the app restarts. Optional `MOCK_USERS`, `MOCK_LATENCY_MS`, and `MOCK_FAIL_PCT` values are supported.

## Packaging

```bash
npm run release
```
