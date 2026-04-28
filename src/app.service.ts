import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Initiative, InitiativeSummary } from '@idemos/common';
import OpenAI from 'openai';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);
  private readonly model = process.env.AI_MODEL ?? 'llama3.2';
  private readonly openai = new OpenAI({
    baseURL: `${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/v1`,
    apiKey: 'ollama',
  });
  private generating = false;

  constructor(
    @InjectRepository(Initiative)
    private readonly initiativeRepo: Repository<Initiative>,
    @InjectRepository(InitiativeSummary)
    private readonly summaryRepo: Repository<InitiativeSummary>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.generatePendingSummaries();
  }

  async generatePendingSummaries(): Promise<void> {
    if (this.generating) {
      this.logger.warn('Summary generation already in progress — skipping');
      return;
    }
    this.generating = true;

    try {
      const pending = await this.initiativeRepo
        .createQueryBuilder('i')
        .leftJoin('i.summary', 's')
        .where('s.id IS NULL')
        .select([
          'i.id',
          'i.title',
          'i.author',
          'i.type',
          'i.legislature',
          'i.currentStatus',
          'i.procedureType',
          'i.committee',
        ])
        .getMany();

      this.logger.log(`Found ${pending.length} initiatives without summary.`);

      for (const initiative of pending) {
        await this.generateSummary(initiative);
      }

      this.logger.log('All pending summaries generated.');
    } finally {
      this.generating = false;
    }
  }

  private async generateSummary(
    initiative: Pick<
      Initiative,
      | 'id'
      | 'title'
      | 'author'
      | 'type'
      | 'legislature'
      | 'currentStatus'
      | 'procedureType'
      | 'committee'
    >,
  ): Promise<void> {
    const {
      id: initiativeId,
      title,
      author,
      type,
      legislature,
      currentStatus,
      procedureType,
      committee,
    } = initiative;

    this.logger.log(`Generating summary for initiative ${initiativeId}`);

    const systemPrompt = [
      `Eres un asistente especializado en resumir iniciativas parlamentarias españolas para ciudadanos sin conocimientos jurídicos ni políticos.`,
      ``,
      `NEUTRALIDAD E IMPARCIALIDAD:`,
      `- Describe los hechos objetivamente, sin valorar si la iniciativa es buena o mala.`,
      `- No uses lenguaje que favorezca ni perjudique a ningún partido, ideología o colectivo.`,
      `- Evita adjetivos valorativos como "importante", "polémico", "necesario", "peligroso".`,
      `- Si el título o el autor usa lenguaje cargado, reformúlalo en términos descriptivos y neutros.`,
      `- No anticipes el resultado ni emitas juicios sobre la viabilidad o el impacto de la norma.`,
      ``,
      `CLARIDAD Y LENGUAJE HUMANO:`,
      `- Escribe en español claro y sencillo, como si se lo explicaras a alguien que nunca ha leído un boletín oficial.`,
      `- Sustituye el lenguaje jurídico-parlamentario por palabras cotidianas cuando sea posible.`,
      `- Usa frases cortas. Evita subordinadas largas y gerundios encadenados.`,
      `- Responde siempre a las preguntas: ¿De qué trata? ¿Quién la impulsa? ¿En qué punto está?`,
      ``,
      `FORMATO DE RESPUESTA:`,
      `- Responde únicamente con el resumen, sin saludos, sin títulos, sin listas ni viñetas.`,
      `- Extensión: entre 3 y 5 frases. Nunca más de 150 palabras.`,
      `- No repitas literalmente el título de la iniciativa; parafraséalo.`,
    ].join('\n');

    const userContent = [
      `Resume la siguiente iniciativa parlamentaria:`,
      ``,
      `Tipo: ${type}`,
      `Legislatura: ${legislature}`,
      `Título: ${title}`,
      `Autor: ${author}`,
      `Tipo de tramitación: ${procedureType}`,
      committee ? `Comisión: ${committee}` : null,
      `Estado actual: ${currentStatus}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? null;
      if (!content) {
        this.logger.warn(`Empty summary returned for ${initiativeId}`);
        return;
      }

      await this.summaryRepo.save(
        this.summaryRepo.create({ initiativeId, content, model: this.model }),
      );
      this.logger.log(`Summary saved for initiative ${initiativeId}`);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to generate summary for ${initiativeId}: ${(err as Error).message}`,
      );
    }
  }
}
