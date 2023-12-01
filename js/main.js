// Global objects
let data, timelineVis, timeSelectorVis, contributorVis, fileTreeVis;
let selectedContributors = []
let dateRange = [];

// TODO: Add dispatcher events as needed
const dispatcher = d3.dispatch('filterDates', 'filterContributors');

/**
 * Load data from CSV file asynchronously and render charts
 */
d3.dsv('%', 'data/processed_dataset.dsv')
    .then((_data) => {
        data = new GitData(_data);

        // TODO: common scales, other shared behaviour

        timelineVis = new TimelineVis(
            {
                parentElement: '#timeline',
            },
            data
        );
        timelineVis.updateVis();

        timeSelectorVis = new TimeSelectorVis(
            {
                parentElement: '#time-selector',
            },
            dispatcher,
            data
        );
        timeSelectorVis.updateVis();

        contributorVis = new ContributorVis(
            {
                parentElement: '#contributor',
            },
            dispatcher,
            data
        );
        contributorVis.updateVis();

        fileTreeVis = new FileTreeVis(
            {
                parentElement: '#file-tree',
            },
            data
        );
        fileTreeVis.updateVis();
    })
    .catch((error) => console.error(error));

/**
 * Dispatcher waits for 'filterDates' event
 * We filter data based on the selected date range and update the timeline, contributor, and file tree vises
 */
dispatcher.on('filterDates', _dateRange => {
    // TODO: Properly filter the data both based on this event and the currently selected contributors
    dateRange = _dateRange;
    data.filterData(selectedContributors, dateRange);

    const currentGranularity = d3.select('#granularity-selector').property('value')
    if (dateRange.length === 2 && currentGranularity === "year") {
        d3.select('#granularity-selector').property('value', 'month')
    } else if (dateRange.length === 0) {
        d3.select('#granularity-selector').property('value', 'year')
    }

    // Update timelineVis
    timelineVis.data = data;
    timelineVis.updateVis();

    // Update contributorVis
    contributorVis.data = data;
    contributorVis.updateVis();

    // Update fileTreeVis
    fileTreeVis.data = data;
    fileTreeVis.updateData();
    fileTreeVis.updateVis();

    if (_dateRange.length === 0) {
        timeSelectorVis.selectedPeriod = [];
    }
    timeSelectorVis.updateVis();
});

/**
 * Dispatcher waits for 'filterContributors' event
 * We filter data based on the selected date range and update the timeline, file tree, and (maybe?) time selector vises
 */
dispatcher.on('filterContributors', _selectedContributors => {
    selectedContributors = _selectedContributors;
    data.filterData(selectedContributors, dateRange);

    // Update timelineVis
    timelineVis.data = data;
    timelineVis.updateVis();

    // Update contributorVis
    contributorVis.data = data;
    contributorVis.updateVis();

    // Update timeSelectorVis. TODO: Not sure if this is needed, but it may be nice to update this too?
    let dataToUse = data.filteredData.length > 0 ? data.filteredData : data.dataWithinDateRange;
    timeSelectorVis.data = dataToUse;
    timeSelectorVis.updateVis();

    // Update fileTreeVis
    fileTreeVis.data = data;
    fileTreeVis.updateData();
    fileTreeVis.updateVis();
});

d3.select('#granularity-selector')
    .on('change', () => timelineVis.updateVis());