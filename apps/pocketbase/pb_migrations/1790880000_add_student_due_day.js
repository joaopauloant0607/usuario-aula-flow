/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const students = app.findCollectionByNameOrId('students');

		// Day of the month the fee is due (0 = use the default day)
		if (!students.fields.getByName('due_day')) {
			students.fields.add(new NumberField({ name: 'due_day', min: 0, max: 31, onlyInt: true }));
			app.save(students);
		}
	},
	(app) => {
		const students = app.findCollectionByNameOrId('students');
		try {
			students.fields.removeByName('due_day');
		} catch (_) {
			/* already gone */
		}
		app.save(students);
	},
);
