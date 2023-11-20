class TimeSelectorVis {

	constructor(_config, _dispatcher, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

		// TODO: Add config defaults
		this.config = {
			parentElement: _config.parentElement,
			containerWidth: _config.containerWidth || container.clientWidth,
			containerHeight: _config.containerHeight || container.clientHeight,
			margin: _config.margin || {top: 20, right: 20, bottom: 20, left: 20}
		};
		this.dispatcher = _dispatcher;
		this.data = _data;
		this.initVis();
	}

	/**
	 * Initialize scales/axes and append static chart elements
	 */
	initVis() {
		let vis = this;
		vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
		vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

		// Define size of SVG drawing area
		vis.svg = d3.select(vis.config.parentElement)
			.attr('width', vis.config.containerWidth)
			.attr('height', vis.config.containerHeight);
		// TODO: Implement
	}

	/**
	 * Prepare the data and scales before we render it.
	 */
	updateVis() {
		let vis = this;
		// TODO: Implement
		vis.renderVis();
	}

	/**
	 * Bind data to visual elements
	 */
	renderVis() {
		let vis = this;
		// TODO: Implement
	}
}
