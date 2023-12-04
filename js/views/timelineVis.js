class TimelineVis {

    constructor(_config, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

        this.config = this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || container.clientWidth,
            containerHeight: _config.containerHeight || container.clientHeight,
            margin: _config.margin || {top: 12, right: 20, bottom: 70, left: 80},
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

        // Initialize scales and axes. Use separate scales for insertions and deletions
        vis.yScalePos = d3.scaleLinear()
            .range([vis.height / 2, 0]);

        vis.yScaleNeg = d3.scaleLinear()
            .range([vis.height / 2, vis.height]);

        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .paddingInner(0.1);

        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0)
            .tickFormat(d => d.toLocaleString('en', {day: 'numeric', month: 'short', year: 'numeric'}));

        // Number of ticks. Scales up based on the scaleFactor.
        vis.tickNumber = 6;

        vis.yAxisPos = d3.axisLeft(vis.yScalePos)
            .ticks(vis.tickNumber);

        vis.yAxisNeg = d3.axisLeft(vis.yScaleNeg)
            .ticks(vis.tickNumber);

        // A scale factor for use in the y-axis
        vis.scaleFactor = 1;

        // Define chart area and groups
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)
            .on('wheel', (event) => {
                    // If in filtered view mode
                    if (selectedContributors.length !== 0 || dateRange.length === 2) {
                        event.preventDefault();
                        const oldScaleFactor = vis.scaleFactor;
                        // Multiplicatively update the scaleFactor
                        vis.scaleFactor = Math.max(vis.scaleFactor * (event.deltaY > 0 ? 1.2 : 0.83), 1);

                        // 1000 is somewhat arbitrary. It's when you can hover any data point even on the lowest granularity
                        if (vis.scaleFactor > 1000) {
                            vis.scaleFactor = oldScaleFactor;
                        } else {
                            // Whenever the scale factor doubles, double the number of tick marks, same for halving.
                            if (Math.floor(Math.log2(oldScaleFactor)) !== Math.floor(Math.log2(vis.scaleFactor))) {
                                vis.scaleFactor > oldScaleFactor ?
                                    vis.tickNumber *= 2 :
                                    vis.tickNumber /= 2;

                                // Lag gets real bad on the whole dataset without this cap. It's mostly an arbitrary number.
                                if (vis.tickNumber < 16000) {
                                    vis.yAxisPos.ticks(vis.tickNumber);
                                    vis.yAxisNeg.ticks(vis.tickNumber);
                                }
                            }

                            vis.yScalePos.range([vis.height / 2, vis.height / 2 * (1 - vis.scaleFactor)]);
                            vis.yScaleNeg.range([vis.height / 2, vis.height / 2 * (1 + vis.scaleFactor)]);
                            vis.updateBarHeights();
                            vis.chart.selectAll(".y-axis-pos").call(vis.yAxisPos);
                            vis.chart.selectAll(".y-axis-neg").call(vis.yAxisNeg);
                        }
                    }
                }
            );

        // Clip paths like in P2 to avoid bars extending past the x-axis when zooming.

        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chartArea = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Apply clipping mask to 'vis.chart' to clip arrows
        vis.chart = vis.chartArea.append('g')
            .attr('clip-path', 'url(#chart-mask)');

        // Initialize clipping mask that covers the whole chart
        vis.chart.append('defs')
            .append('clipPath')
            .attr('id', 'chart-mask')
            .append('rect')
            .attr('width', vis.config.containerWidth)
            .attr('y', vis.config.margin.top)
            .attr('x', -vis.config.margin.left)
            .attr('height', vis.height);

        vis.xAxisG = vis.chartArea.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height + vis.config.margin.top})`);

        vis.yAxisPosG = vis.chart.append('g')
            .attr('class', 'axis y-axis-pos');

        vis.yAxisNegG = vis.chart.append('g')
            .attr('class', 'axis y-axis-neg');

        vis.svg.append('text')
            .attr('class', 'timeline-axis-title')
            .attr('x', 0)
            .attr('y', 6)
            .attr('dy', '.71em')
            .text('# of insertions');

        vis.svg.append('text')
            .attr('class', 'timeline-axis-title')
            .attr('x', 0)
            .attr('y', vis.height+20)
            .attr('dy', '.71em')
            .text('# of deletions');

        vis.svg.append('text')
            .attr('class', 'timeline-title')
            .attr('x', vis.width/2 + vis.config.margin.left)
            .attr('y', 6)
            .attr('dy', '.71em')
            .text('Timeline of commits & their sizes');
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;
        vis.granularity = d3.select('#granularity-selector').property('value')

        // Reset the zoom information
        vis.scaleFactor = 1;
        vis.tickNumber = 6;
        vis.yAxisPos.ticks(vis.tickNumber);
        vis.yAxisNeg.ticks(vis.tickNumber);

        vis.rolledData = data.getGroupCommits(vis.granularity);

        // Thought this could be removed, but without it when a contributor is selected then a date range is selected
        // the date range is not honoured.
        if (dateRange.length === 2) {
            vis.rolledData = vis.rolledData.filter((d) => {
                return (dateRange[0] <= d[0] && d[0] <= dateRange[1]);
            })
        }

        // Adjust scales based off the maximum stack size and date range
        const populatedDateRange = this.generateDateRange(
            vis.rolledData[0] ? vis.rolledData[0][0] : dateRange[0],
            vis.rolledData[vis.rolledData.length - 1] ? vis.rolledData[vis.rolledData.length - 1][0] : dateRange[1],
            vis.granularity
        );
        vis.xScale.domain(populatedDateRange);
        let maximalRange = d3.max([
            d3.max(vis.rolledData, group => d3.sum(group[1], d => d.insertions || 0)),
            d3.max(vis.rolledData, group => d3.sum(group[1], d => d.deletions || 0))
        ])
        vis.yScalePos.domain([0, maximalRange]).range([vis.height / 2, 0]);
        vis.yScaleNeg.domain([0, maximalRange]).range([vis.height / 2, vis.height]);

        // Sort the data within each stack so smaller commits are in the center. This is what makes the zooming effective.
        vis.rolledDataPos = vis.rolledData.map((arr) => {
            const sortedArr = [...arr[1]].sort((a, b) => (a.insertions || 0) - (b.insertions || 0));
            return [arr[0], sortedArr];
        })

        vis.rolledDataNeg = vis.rolledData.map((arr) => {
            const sortedArr = [...arr[1]].sort((a, b) => (a.deletions || 0) - (b.deletions || 0));
            return [arr[0], sortedArr];
        })

        // Add running total values so that each bar knows where to be placed within its stack. Modify object in place.
        vis.rolledDataPos.forEach(group => {
            let runningInsertionsTotal = 0;
            group[1].forEach(commit => {
                commit.runningInsertionsTotal = runningInsertionsTotal;
                runningInsertionsTotal += commit.insertions || 0;
            });
            group.push(runningInsertionsTotal);
        });

        vis.rolledDataNeg.forEach(group => {
            let runningDeletionsTotal = 0;
            group[1].forEach(commit => {
                commit.runningDeletionsTotal = runningDeletionsTotal;
                runningDeletionsTotal += commit.deletions || 0;
            });
            group.push(runningDeletionsTotal);
        });

        // Only display some labels on the x-axis to avoid cluttering it. A bit of a nasty trick but oh well.
        const maxLabels = 25;
        const numTicks = Math.min(maxLabels, populatedDateRange.length);
        const tickStep = Math.ceil(populatedDateRange.length / numTicks);
        const tickValues = populatedDateRange.map((d, i) => {
            return i % tickStep === 0 ? d : null;
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
        // If any filter is present
        if (selectedContributors.length !== 0 || dateRange.length === 2) {
            vis.renderFilteredView()
        } else {
            vis.renderOverview()
        }

        vis.xAxisG.call(vis.xAxis);
        vis.yAxisPosG.call(vis.yAxisPos);
        vis.yAxisNegG.call(vis.yAxisNeg);

        // Rotate the x-axis labels
        vis.chartArea.selectAll(".x-axis text")
            .attr("transform", "translate(-8, 3) rotate(-45) ")
            .style("text-anchor", "end");
    }

    /**
     * Render the overview, in which we show a single bar for each stack
     */
    renderOverview() {
        let vis = this;
        vis.stacks = vis.chart.selectAll('.stack')
            .data(vis.rolledData, d => d[0])
            .join('g')
            .attr('class', 'stack')
            .attr('transform', d => `translate(${vis.xScale(d[0])},0)`)
            .attr('width', vis.xScale.bandwidth());

        vis.delimPos = vis.stacks.selectAll('.delimPos')
            .data([])
            .join('rect')
            .attr('class', 'delimPos');

        vis.delimNeg = vis.stacks.selectAll('.delimNeg')
            .data([])
            .join('rect')
            .attr('class', 'delimNeg');

        // There is no filter, render only a single bar per stack
        // Level 2a, insertion bars
        vis.posBars = vis.stacks.selectAll('.barPos')
            .data((d, i) => [vis.rolledDataPos[i]], (d, i) => i)
            .join('rect')
            .attr('class', 'barPos bar')
            .attr('width', vis.xScale.bandwidth())
            .attr('y', d => vis.yScalePos(d[2]))
            .attr('height', d => vis.height / 2 - vis.yScalePos(d[2]))
            .style('fill', 'mediumseagreen');

        // Level 2b, deletion bars
        vis.negBars = vis.stacks.selectAll('.barNeg')
            .data((d, i) => [vis.rolledDataNeg[i]], (d, i) => i)
            .join('rect')
            .attr('class', 'barNeg bar')
            .attr('width', vis.xScale.bandwidth())
            .attr('y', d => vis.height / 2)
            .attr('height', d => vis.yScaleNeg(d[2]) - vis.height/2)
            .style('fill', 'orangered');

        vis.stacks.selectAll('.bar')
            .on("mouseover", function (event, d) {
                // Used function so 'this' refers to the dom node selected
                const isPos = this.getAttribute('class').includes('barPos');
                d3.select("#tooltip")
                    .style("display", "block")
                    .style("left", event.pageX + vis.config.tooltipPadding + "px")
                    .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
            <div class='tooltip-title'>${d[0].toLocaleString('en', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
            <p>Commits made during this ${vis.granularity}</p>
			${isPos ? `<div>Additions: <strong>${d[2]}</strong></div>`
                    : `<div>Deletions: <strong>${d[2]}</strong></div>`}
          `);
            })
            .on("mouseleave", () => {
                d3.select("#tooltip").style("display", "none");
            })
    }

    /**
     * Render the filtered view, which has each commit as an individual bar
     */
    renderFilteredView() {
        let vis = this;
        // Level 1, the stacks
        vis.stacks = vis.chart.selectAll('.stack')
            .data(vis.rolledData, d => d[0])
            .join('g')
            .attr('class', 'stack')
            .attr('transform', d => `translate(${vis.xScale(d[0])},0)`)
            .attr('width', vis.xScale.bandwidth());

        // Level 2a, insertion bars
        vis.posBars = vis.stacks.selectAll('.barPos')
            .data((d, i) => vis.rolledDataPos[i][1], (d, i) => i)
            .join('rect')
            .attr('class', 'barPos bar')
            .attr('width', vis.xScale.bandwidth());

        // Level 2b, deletion bars
        vis.negBars = vis.stacks.selectAll('.barNeg')
            .data((d, i) => vis.rolledDataNeg[i][1], (d, i) => i)
            .join('rect')
            .attr('class', 'barNeg bar')
            .attr('width', vis.xScale.bandwidth());

        // Add a thin black bar as delimiters between bars in a stack, since you can't set only a top stroke on rects
        vis.delimPos = vis.stacks.selectAll('.delimPos')
            .data((d, i) => vis.rolledDataPos[i][1], (d, i) => i)
            .join('rect')
            .attr('class', 'delimPos')
            .attr('height', 1)
            .attr('width', vis.xScale.bandwidth())
            .style('pointer-events', 'none');

        vis.delimNeg = vis.stacks.selectAll('.delimNeg')
            .data((d, i) => vis.rolledDataNeg[i][1], (d, i) => i)
            .join('rect')
            .attr('class', 'delimNeg')
            .attr('height', 1)
            .attr('width', vis.xScale.bandwidth())
            .style('pointer-events', 'none');

        vis.updateBarHeights();

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

        if (selectedContributors.length !== 0) {
            vis.stacks.selectAll('.bar')
                .style('fill', d => {
                    return selectedContributors.find(contObj => contObj.name === d.authorName).color;
                });
        }
    }

    /**
     * Produce a populated array of dates based on the given start and end dates, with a date at $granularity increments
     * @param startDate
     * @param endDate
     * @param granularity
     * @returns An array of Date objects
     */
    generateDateRange(startDate, endDate, granularity) {
        // Copy constructors are to avoid monkeying with the inputs
        let currentDate = new Date(startDate);
        const _endDate = new Date(endDate);
        const dateArray = [];

        while (currentDate <= _endDate) {
            dateArray.push(new Date(currentDate));

            switch (granularity) {
                case "year":
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
                case "month":
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case "week":
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case "day":
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                default:
                    console.error("Invalid granularity");
                    return [];
            }
        }

        return dateArray;
    }

    /**
     * Sets the heights and vertical locations of the bars based off the y-scale and data values.
     */
    updateBarHeights() {
        let vis = this;
        vis.posBars
            .attr('y', d => vis.yScalePos((d.insertions || 0) + d.runningInsertionsTotal))
            .attr('height', d => vis.height / 2 - vis.yScalePos(d.insertions || 0));
        vis.delimPos
            .attr('y', d => vis.yScalePos(d.runningInsertionsTotal + (d.insertions || 0)));
        vis.negBars
            .attr('y', d => vis.yScaleNeg(d.runningDeletionsTotal))
            .attr('height', d => vis.yScaleNeg(d.deletions || 0) - vis.height / 2);
        vis.delimNeg
            .attr('y', d => vis.yScaleNeg(d.runningDeletionsTotal + (d.deletions || 0)));
    }
}
