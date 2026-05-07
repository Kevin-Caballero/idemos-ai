# AI Service

Servicio de generación de resúmenes de iniciativas parlamentarias. Al arrancar (y al recibir un mensaje RabbitMQ), detecta las iniciativas sin resumen y genera uno mediante un modelo LLM local a través de Ollama.

## Cómo funciona

Consulta la base de datos buscando `Initiative` sin `InitiativeSummary` asociado. Para cada una, envía el texto de la iniciativa al modelo configurado y persiste el resumen generado.

El proceso es secuencial (una iniciativa a la vez) para no saturar la GPU/CPU. Si ya hay una generación en curso, los nuevos mensajes RabbitMQ se ignoran hasta que termine.

## Variables de entorno

| Variable       | Por defecto              | Descripción                |
| -------------- | ------------------------ | -------------------------- |
| `OLLAMA_URL`   | `http://localhost:11434` | URL del servidor Ollama    |
| `AI_MODEL`     | `llama3.2`               | Modelo a utilizar          |
| `DB_HOST`      | `localhost`              | Host de PostgreSQL         |
| `DB_PORT`      | `5432`                   | Puerto de PostgreSQL       |
| `DB_NAME`      | `idemos`                 | Nombre de la base de datos |
| `RABBITMQ_URL` | `amqp://localhost:5672`  | URL de RabbitMQ            |

## Requisitos

| Tool / Package          | Version |
| ----------------------- | ------- |
| Node.js                 | >= 20.0 |
| npm                     | >= 10.0 |
| TypeScript              | ^5.7.3  |
| NestJS (`@nestjs/core`) | ^11.0.1 |
| TypeORM                 | ^0.3.20 |
| `@nestjs/typeorm`       | ^11.0.0 |
| `@nestjs/microservices` | ^11.0.1 |
| `openai`                | ^4.97.0 |
| PostgreSQL (`pg`)       | ^8.13.3 |

> Requiere una instancia de [Ollama](https://ollama.com/) accesible desde el servicio.

## Ollama y Docker

El servicio AI corre en local (fuera de Docker), pero **Ollama sí se levanta en un contenedor** como parte de la infraestructura del monorepo:

```bash
npm run dev          # CPU (por defecto)
USE_GPU=true npm run dev  # GPU (NVIDIA)
```

Cuando `USE_GPU=true`, se aplica el override `docker-compose.dev.gpu.yml`, que configura el acceso a la GPU a través del **NVIDIA Container Toolkit**. Requiere tenerlo instalado en el host ([guía oficial](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)).

## Scripts

```bash
npm run start:dev   # development (watch mode)
npm run start:prod  # production
npm run test        # unit tests
```
