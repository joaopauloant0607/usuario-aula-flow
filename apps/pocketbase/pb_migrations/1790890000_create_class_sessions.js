/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		// The collection may already exist if it was created by hand in production.
		try {
			app.findCollectionByNameOrId('class_sessions');
			return;
		} catch (_) {
			/* create it below */
		}

		const users = app.findCollectionByNameOrId('users');
		const classes = app.findCollectionByNameOrId('classes');
		const ownerRule = "@request.auth.id != '' && @request.auth.id = owner";

		const sessions = new Collection({
			type: 'base',
			name: 'class_sessions',
			listRule: ownerRule,
			viewRule: ownerRule,
			createRule: ownerRule,
			updateRule: ownerRule,
			deleteRule: ownerRule,
			fields: [
				{
					name: 'class',
					type: 'relation',
					required: true,
					maxSelect: 1,
					collectionId: classes.id,
					cascadeDelete: true,
				},
				// Class date as YYYY-MM-DD
				{ name: 'date', type: 'text', required: true, max: 10 },
				{
					name: 'status',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['confirmed', 'makeup', 'done'],
				},
				{ name: 'makeup_date', type: 'text', max: 10 },
				{ name: 'makeup_time', type: 'text', max: 5 },
				{
					name: 'owner',
					type: 'relation',
					required: true,
					maxSelect: 1,
					collectionId: users.id,
					cascadeDelete: false,
				},
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
			],
			indexes: ['CREATE UNIQUE INDEX idx_class_sessions_class_date ON class_sessions (class, date)'],
		});
		app.save(sessions);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('class_sessions'));
		} catch (_) {
			/* already gone */
		}
	},
);
