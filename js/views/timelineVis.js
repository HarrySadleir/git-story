class TimelineVis {

	constructor(_config, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

		this.config = this.config = {
			parentElement: _config.parentElement,
			containerWidth: _config.containerWidth || container.clientWidth,
			containerHeight: _config.containerHeight || container.clientHeight,
			margin: _config.margin || {top: 20, right: 20, bottom: 60, left: 50},
			tooltipPadding: 10
		};
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

		// Initialize scales and axes. Use separate scales for insertions and deletions
		vis.yScalePos = d3.scaleLinear()
			.range([vis.height / 2, 0]);

		vis.yScaleNeg = d3.scaleLinear()
			.range([0, vis.height / 2]);

		vis.xScale = d3.scaleBand()
			.range([0, vis.width])
			.paddingInner(0.1);

		vis.xAxis = d3.axisBottom(vis.xScale)
			.tickSizeOuter(0)
			.tickFormat(d => d.toLocaleString('en', {day: 'numeric', month: 'short', year: 'numeric'}));

		vis.yAxisPos = d3.axisLeft(vis.yScalePos)
			.ticks(8);

		vis.yAxisNeg = d3.axisLeft(vis.yScaleNeg)
			.ticks(8);

		// Define chart area and groups
		vis.svg = d3.select(vis.config.parentElement)
			.attr('width', vis.config.containerWidth)
			.attr('height', vis.config.containerHeight);

		vis.chart = vis.svg.append('g')
			.attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

		vis.xAxisG = vis.chart.append('g')
			.attr('class', 'axis x-axis')
			.attr('transform', `translate(0,${vis.height})`);

		vis.yAxisPosG = vis.chart.append('g')
			.attr('class', 'axis y-axis-pos');

		vis.yAxisNegG = vis.chart.append('g')
			.attr('class', 'axis y-axis-neg')
			.attr('transform', `translate(0,${vis.height / 2})`);
	}

	/**
	 * Prepare the data and scales before we render it.
	 */
	updateVis() {
		let vis = this;
		vis.rolledData = data.getGroupCommits(
			d3.select('#granularity-selector').property('value')
		);

		// Adjust scales based off the maximum stack size
		vis.xScale.domain(vis.rolledData.map(d => d[0]));
		let maximalRange = d3.max([
			d3.max(vis.rolledData, group => d3.sum(group[1], d => d.insertions || 0)),
			d3.max(vis.rolledData, group => d3.sum(group[1], d => d.deletions || 0))
		])
		vis.yScalePos.domain([0, maximalRange]);
		vis.yScaleNeg.domain([0, maximalRange]);

		// Add running total values so that each bar knows where to be placed within its stack. Modify object in place.
		vis.rolledData.forEach(group => {
			let runningInsertionsTotal = 0;
			let runningDeletionsTotal = 0;
			group[1].forEach(commit => {
				commit.runningInsertionsTotal = runningInsertionsTotal;
				commit.runningDeletionsTotal = runningDeletionsTotal;

				runningInsertionsTotal += commit.insertions || 0;
				runningDeletionsTotal += commit.deletions || 0;
			});
		});

		// Only display some labels on the x-axis to avoid cluttering it. A bit of a nasty trick but oh well.
		const maxLabels = 25; // TODO: Adjust this value as needed when screen size changes
		const numTicks = Math.min(maxLabels, vis.rolledData.length);
		const tickStep = Math.ceil(vis.rolledData.length / numTicks);
		const tickValues = vis.rolledData.map((d, i) => {
			return i % tickStep === 0 ? d[0] : null;
		}).filter(d => {
			return d !== null;
		});
		vis.xAxis.tickValues(tickValues);

		vis.renderVis();
	}

	/**
	 * Bind data to visual elements
	 */
	renderVis() {
		let vis = this;
		// Level 1, the stacks
		vis.stacks = vis.chart.selectAll('.stack')
			.data(vis.rolledData, d => d[0])
			.join('g')
			.attr('class', 'stack')
			.attr('transform', d => `translate(${vis.xScale(d[0])},0)`);

		// Level 2a, insertion bars
		vis.posBars = vis.stacks.selectAll('.barPos')
			.data(d => d[1], (d, i) => i)
			.join('rect')
			.attr('class', 'barPos bar')
			.attr('y', d => vis.yScalePos((d.insertions || 0) + d.runningInsertionsTotal))
			.attr('height', d => vis.height / 2 - vis.yScalePos(d.insertions || 0))
			.attr('width', vis.xScale.bandwidth());

		// Level 2b, deletion bars
		vis.negBars = vis.stacks.selectAll('.barNeg')
			.data(d => d[1], (d, i) => i)
			.join('rect')
			.attr('class', 'barNeg bar')
			.attr('y', d => vis.height / 2 + vis.yScaleNeg(d.runningDeletionsTotal))
			.attr('height', d => vis.yScaleNeg(d.deletions || 0))
			.attr('width', vis.xScale.bandwidth())

		// Hovering behaviour for both insertion and deletion bars
		vis.stacks.selectAll('.bar')
			.on("mouseover", function (event, d) {
				// Used function so 'this' refers to the dom node selected
				const isPos = this.getAttribute('class').includes('barPos');
				d3.select("#tooltip")
					.style("display", "block")
					.style("left", event.pageX + vis.config.tooltipPadding + "px")
					.style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
            <div class='tooltip-title'>${d.commitId}</div>
            <p>From ${d.authorName}: ${d.commitMessage}</p>
			${isPos ? `<div>Additions: <strong>${d.insertions || 0}</strong></div>`
					: `<div>Deletions: <strong>${d.deletions || 0}</strong></div>`}
          `);
			})
			.on("mouseleave", () => {
				d3.select("#tooltip").style("display", "none");
			})

		vis.xAxisG.call(vis.xAxis);
		vis.yAxisPosG.call(vis.yAxisPos);
		vis.yAxisNegG.call(vis.yAxisNeg);

		// Rotate the x-axis labels
		vis.chart.selectAll(".x-axis text")
			.attr("transform", "translate(-8, 3) rotate(-45) ")
			.style("text-anchor", "end");
	}
}
