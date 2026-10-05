/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const students = app.findCollectionByNameOrId('students');

		// Monthly amount the student pays (R$)
		if (!students.fields.getByName('monthly_fee')) {
			students.fields.add(new NumberField({ name: 'monthly_fee', min: 0 }));
		}

		// How many classes per week (0 = not informed)
		if (!students.fields.getByName('classes_per_week')) {
			students.fields.add(
				new NumberField({ name: 'classes_per_week', min: 0, max: 7, onlyInt: true }),
			);
		}

		app.save(students);
	},
	(app) => {
		const students = app.findCollectionByNameOrId('students');
		for (const name of ['monthly_fee', 'classes_per_week']) {
			try {
				students.fields.removeByName(name);
			} catch (_) {
				/* already gone */
			}
		}
		app.save(students);
	},
);
