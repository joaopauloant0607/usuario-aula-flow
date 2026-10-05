/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');

		// ---- students ----
		let students;
		try {
			students = app.findCollectionByNameOrId('students');
		} catch (_) {
			students = new Collection({
				type: 'base',
				name: 'students',
				listRule: "@request.auth.id != '' && @request.auth.id = owner",
				viewRule: "@request.auth.id != '' && @request.auth.id = owner",
				createRule: "@request.auth.id != '' && @request.auth.id = owner",
				updateRule: "@request.auth.id != '' && @request.auth.id = owner",
				deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
				fields: [
					{ name: 'name', type: 'text', required: true, min: 1, max: 200 },
					{ name: 'email', type: 'email' },
					{ name: 'phone', type: 'text', max: 40 },
					{ name: 'subject', type: 'text', max: 120 },
					{ name: 'notes', type: 'text', max: 2000 },
					{
						name: 'status',
						type: 'select',
						required: true,
						maxSelect: 1,
						values: ['active', 'inactive'],
					},
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
			});
			app.save(students);
		}

		// ---- classes ----
		let classes;
		try {
			classes = app.findCollectionByNameOrId('classes');
		} catch (_) {
			classes = new Collection({
				type: 'base',
				name: 'classes',
				listRule: "@request.auth.id != '' && @request.auth.id = owner",
				viewRule: "@request.auth.id != '' && @request.auth.id = owner",
				createRule: "@request.auth.id != '' && @request.auth.id = owner",
				updateRule: "@request.auth.id != '' && @request.auth.id = owner",
				deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
				fields: [
					{
						name: 'student',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: students.id,
						cascadeDelete: true,
					},
					{ name: 'subject', type: 'text', max: 120 },
					{
						name: 'weekday',
						type: 'select',
						required: true,
						maxSelect: 1,
						values: ['0', '1', '2', '3', '4', '5', '6'],
					},
					{ name: 'start_time', type: 'text', required: true, max: 5 },
					{ name: 'duration_minutes', type: 'number', min: 15, max: 480 },
					{ name: 'notes', type: 'text', max: 500 },
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
			});
			app.save(classes);
		}

		// ---- payments ----
		try {
			app.findCollectionByNameOrId('payments');
		} catch (_) {
			const payments = new Collection({
				type: 'base',
				name: 'payments',
				listRule: "@request.auth.id != '' && @request.auth.id = owner",
				viewRule: "@request.auth.id != '' && @request.auth.id = owner",
				createRule: "@request.auth.id != '' && @request.auth.id = owner",
				updateRule: "@request.auth.id != '' && @request.auth.id = owner",
				deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
				fields: [
					{
						name: 'student',
						type: 'relation',
						maxSelect: 1,
						collectionId: students.id,
						cascadeDelete: false,
					},
					{ name: 'description', type: 'text', max: 200 },
					{ name: 'amount', type: 'number', required: true, min: 0 },
					{ name: 'due_date', type: 'date' },
					{ name: 'paid_date', type: 'date' },
					{
						name: 'status',
						type: 'select',
						required: true,
						maxSelect: 1,
						values: ['pending', 'paid'],
					},
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
			});
			app.save(payments);
		}
	},
	(app) => {
		for (const name of ['classes', 'payments', 'students']) {
			try {
				const c = app.findCollectionByNameOrId(name);
				app.delete(c);
			} catch (_) {
				/* already gone */
			}
		}
	},
);
