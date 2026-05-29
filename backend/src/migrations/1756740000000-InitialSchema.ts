import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class InitialSchema1756740000000 implements MigrationInterface {
	name = 'InitialSchema1756740000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.createTable(
			new Table({
				name: 'podcasts',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						isNullable: false,
					},
					{
						name: 'title',
						type: 'varchar',
						isNullable: false,
					},
					{
						name: 'description',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'rss_url',
						type: 'varchar',
						isNullable: false,
					},
					{
						name: 'imageUrl',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'authorName',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'language',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'categories',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'country',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'episodeCount',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'websiteUrl',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'popularity',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'active',
						type: 'boolean',
						isNullable: false,
						default: true,
					},
					{
						name: 'added_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updated_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'lastFetchedAt',
						type: 'timestamp with time zone',
						isNullable: true,
					},
				],
			}),
			true,
		);

		await queryRunner.createTable(
			new Table({
				name: 'radio_stations',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						isNullable: false,
					},
					{
						name: 'name',
						type: 'varchar',
						isNullable: false,
					},
					{
						name: 'url',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'stream_url',
						type: 'varchar',
						isNullable: false,
					},
					{
						name: 'country',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'countrycode',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'state',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'language',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'tags',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'favicon',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'bitrate',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'codec',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'votes',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'ssl',
						type: 'boolean',
						isNullable: false,
						default: false,
					},
					{
						name: 'cached_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updated_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
				],
			}),
			true,
		);

		await queryRunner.createTable(
			new Table({
				name: 'podcast_episodes',
				columns: [
					{
						name: 'id',
						type: 'uuid',
						isPrimary: true,
						isNullable: false,
					},
					{
						name: 'podcastId',
						type: 'uuid',
						isNullable: false,
					},
					{
						name: 'title',
						type: 'varchar',
						isNullable: false,
					},
					{
						name: 'description',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'audioUrl',
						type: 'text',
						isNullable: false,
					},
					{
						name: 'duration',
						type: 'int',
						isNullable: true,
					},
					{
						name: 'guid',
						type: 'varchar',
						isNullable: true,
					},
					{
						name: 'imageUrl',
						type: 'text',
						isNullable: true,
					},
					{
						name: 'publishDate',
						type: 'timestamp with time zone',
						isNullable: false,
					},
					{
						name: 'playCount',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'added_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
					{
						name: 'updated_at',
						type: 'timestamp with time zone',
						isNullable: false,
            default: 'CURRENT_TIMESTAMP',
					},
				],
			}),
			true,
		);

		await queryRunner.createForeignKey(
			'podcast_episodes',
			new TableForeignKey({
				columnNames: ['podcastId'],
				referencedTableName: 'podcasts',
				referencedColumnNames: ['id'],
				onDelete: 'NO ACTION',
				onUpdate: 'NO ACTION',
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const podcastEpisodesTable = await queryRunner.getTable('podcast_episodes');
		const podcastEpisodesForeignKey = podcastEpisodesTable?.foreignKeys.find(
			(foreignKey) => foreignKey.columnNames.includes('podcastId'),
		);

		if (podcastEpisodesForeignKey) {
			await queryRunner.dropForeignKey('podcast_episodes', podcastEpisodesForeignKey);
		}

		await queryRunner.dropTable('podcast_episodes');
		await queryRunner.dropTable('radio_stations');
		await queryRunner.dropTable('podcasts');
	}
}
