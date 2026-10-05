/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const classes = app.findCollectionByNameOrId('classes');

		// Add location field (for in-person / online class location)
		if (!classes.fields.getByName('location')) {
			classes.fields.add(new TextField({ name: 'location', max: 200 }));
		}

		// Change weekday from single-select to multi-select (recurring classes)
		const weekday = classes.fields.getByName('weekday');
		if (weekday && weekday.maxSelect !== 7) {
			weekday.maxSelect = 7;
		}
		app.save(classes);

		// Backfill existing records: wrap single string value into an array
		const records = app.findAllRecords(classes);
		for (const rec of records) {
			const w = rec.get('weekday');
			if (typeof w === 'string' && w !== '') {
				rec.set('weekday', [w]);
				app.save(rec);
			} else if (Array.isArray(w) && w.length === 0) {
				// leave empty
			}
		}
	},
	(app) => {
		const classes = app.findCollectionByNameOrId('classes');
		const weekday = classes.fields.getByName('weekday');
		if (weekday) weekday.maxSelect = 1;
		try {
			classes.fields.removeByName('location');
		} catch (_) {
			/* already gone */
		}
		app.save(classes);

		const records = app.findAllRecords(classes);
		for (const rec of records) {
			const w = rec.get('weekday');
			if (Array.isArray(w) && w.length > 0) {
				rec.set('weekday', w[0]);
				app.save(rec);
			}
		}
	},
);
