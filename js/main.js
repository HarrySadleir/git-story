// Global objects
let data, dateRange, selectedContributors, timelineVis, timeSelectorVis, contributorVis, fileTreeVis;

// TODO: Add dispatcher events as needed
const dispatcher = d3.dispatch('filterDates', 'filterContributors');

/**
 * Load data from CSV file asynchronously and render charts
 */
d3.csv('data/sanitized-data.csv')
	.then(_data => {
		data = _data;
		data.forEach(d => {
			// TODO: adjust header names and types, call more significant parsing as needed
			return d;
		});

		// TODO: common scales, other shared behaviour

		timelineVis = new TimelineVis({
			parentElement: '#timeline',
		}, data);
		timelineVis.updateVis();

		timeSelectorVis = new TimeSelectorVis({
			parentElement: '#time-selector',
		}, dispatcher, data);
		timeSelectorVis.updateVis();

		contributorVis =  new ContributorVis({
			parentElement: '#contributor',
		}, dispatcher, data);
		contributorVis.updateVis();

		fileTreeVis =  new FileTreeVis({
			parentElement: '#file-tree',
		}, data);
		fileTreeVis.updateVis();
	})
	.catch(error => console.error(error));

/**
 * Dispatcher waits for 'filterDates' event
 * We filter data based on the selected date range and update the timeline, contributor, and file tree vises
 */
dispatcher.on('filterDates', _dateRange => {
	// TODO: Properly filter the data both based on this event and the currently selected contributors
	dateRange = _dateRange;
	let filteredData = data; // data.filter(... dateRange, selectedContributors)

	// Update timelineVis
	timelineVis.data = filteredData;
	timelineVis.updateVis();

	// Update contributorVis
	contributorVis.data = filteredData;
	contributorVis.updateVis();

	// Update fileTreeVis
	fileTreeVis.data = filteredData;
	fileTreeVis.updateVis();
});

/**
 * Dispatcher waits for 'filterContributors' event
 * We filter data based on the selected date range and update the timeline, file tree, and (maybe?) time selector vises
 */
dispatcher.on('filterContributors', _selectedContributors => {
	// TODO: Properly filter the data both based on this event and the currently selected date range
	selectedContributors = _selectedContributors;
	let filteredData = data; // data.filter(... dateRange, selectedContributors)

	// Update timelineVis
	timelineVis.data = filteredData;
	timelineVis.updateVis();

	// Update timeSelectorVis. TODO: Not sure if this is needed, but it may be nice to update this too?
	timeSelectorVis.data = filteredData;
	timeSelectorVis.updateVis();

	// Update fileTreeVis
	fileTreeVis.data = filteredData;
	fileTreeVis.updateVis();
});