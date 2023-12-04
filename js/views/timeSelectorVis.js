class TimeSelectorVis {
    constructor(_config, _dispatcher, _data) {
      const container = document.getElementById(_config.parentElement.substring(1));

        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || container.clientWidth,
            containerHeight: _config.containerHeight || container.clientHeight,
            margin: _config.margin || {top: 30, right: 70, bottom: 10, left: 70},
        };
        this.dispatcher = _dispatcher;
        this.helper = new TimeSelectorHelper();
        this.data = this.helper.addCommitDate(_data.dataWithinDateRange);
        this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.contributionColor = ['#EBEDF0', '#9BE9A8', '#41C463', '#30A14E', '#216E39'];
        this.tooltipLeftPadding = -100;
        this.tooltipTopPadding = -40;
        this.selectedYear = null;
        this.selectedPeriod = [];
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
        vis.svg = d3.select(vis.config.parentElement).attr('width', vis.config.containerWidth).attr('height', vis.config.containerHeight);

        vis.chart = vis.svg.append('g').attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.yScale = d3.scaleBand().range([0, vis.height - 20]);
        vis.xScale = d3.scaleBand().range([0, vis.width]);
        vis.xAxis = d3.axisTop(vis.xScale).tickSize(0).tickValues(this.months);
        vis.yAxis = d3.axisLeft(vis.yScale).tickSize(0).tickValues(['Mon', 'Wed', 'Fri']);
        vis.xAxisG = vis.chart.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0, -5)`);
        vis.yAxisG = vis.chart.append('g').attr('class', 'axis y-axis time-selector-y-axis');
        vis.svg.append('text').attr('class', 'axis-title').attr('x', vis.width / 2).attr('y', 1).attr('dy', '.71em').text('Contributions');

        let contributionGroup = vis.chart.selectAll('.color-group').data(vis.contributionColor).join('g');
        contributionGroup.attr('transform', (d) => `translate(${vis.config.containerWidth - 107.5}, 0)`).attr('class', 'color-group');
        let contributionColorLabels = contributionGroup
            .selectAll('.color-label')
            .data((d) => [d])
            .join('rect')
            .attr('class', 'color-label')
            .attr('display', (d) => (d === '#2A9ADB' ? 'none' : 'block'))
            .attr('width', 6)
            .attr('height', 6)
            .attr('rx', 1)
            .attr('stroke', '#E0E2E5')
            .attr('stroke-width', 0.5)
            .attr('fill', (d) => d)
            .attr('transform', (d) => {
                const colorIndex = vis.contributionColor.indexOf(d);
                return `translate(${(colorIndex * 10.5) - 140}, ${vis.height - 16})`;
            });
        vis.svg
            .append('text')
            .attr('class', 'contribution-label')
            .attr('x', vis.config.containerWidth - 205)
            .attr('y', vis.height + 20)
            .text('Less');
        vis.svg
            .append('text')
            .attr('class', 'contribution-label')
            .attr('x', vis.config.containerWidth - 126)
            .attr('y', vis.height + 20)
            .text('More');
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {  
        let vis = this;
        vis.groupedYears = d3.groups(this.data, (d) => d.commitDate.getFullYear());
        vis.selectedYear  = vis.selectedYear ? vis.selectedYear : vis.groupedYears[vis.groupedYears.length - 1][0];
        const selectYearIndex = this.helper.getYearDataIndex(vis.groupedYears, vis.selectedYear);
        if (vis.groupedYears[selectYearIndex]) {
          vis.selectedYearData = vis.groupedYears[selectYearIndex][1];
        } else {
          vis.selectedYearData = [];
        }
        vis.xValue = (d) => d[0];
        vis.yValue = (d) => this.week[d.day.getDay()];
        vis.groupedWeekData = this.helper.createXDomain(vis.selectedYear, vis.selectedYearData);
        vis.xScale.domain(vis.groupedWeekData.map(vis.xValue));
        vis.yScale.domain(this.week);
        vis.contributionIncrement = Math.floor(this.helper.getMaxCount() / 5);
        vis.renderVis();
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this;
        let weeks = vis.chart
            .selectAll('.week')
            .data(vis.groupedWeekData, (d) => d[0])
            .join('g');
        weeks.attr('transform', (d) => `translate(${vis.xScale(vis.xValue(d)) + 5}, 0)`).attr('class', 'week');

        let days = weeks
            .selectAll('.day')
            .data((d) => d[1])
            .join('g');
        days.attr('transform', (d) => `translate(0, ${vis.yScale(vis.yValue(d))})`).attr('class', 'day');

        let dayBlock = days
            .selectAll('.block')
            .data((d) => [d])
            .join('rect')
            .attr('class', (d) => {
                if (this.selectedPeriod.length === 2 && this.selectedPeriod[0] <= d.day && this.selectedPeriod[1] >= d.day) {
                    return 'block block-selected';
                } else {
                    return 'block';
                }
            })
            .attr('width', (vis.width / 100))
            .attr('height', (vis.width / 100))
            .attr('rx', 1)
            .attr('fill', (d) => this.helper.fillBlock(d, vis.contributionIncrement, this.contributionColor))
            .classed('time-selector-active', (d) => !vis.yearChange && this.helper.checkDate(d, this.selectedPeriod) !== -1)
            .on('mouseover', (event, d) => this.helper.mouseOver(event, d, this.fullMonths, vis.tooltipLeftPadding, vis.tooltipTopPadding))
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            })
            .on('click', (event, d) => {
                if (vis.yearChange) {
                  this.selectedPeriod = [];
                }
                vis.yearChange = false;
                this.selectedPeriod = this.helper.selectPeriod(vis, d, this.selectedPeriod);
            });

        d3.select('#select-year').on('change', function (d) {
            vis.selectedYear = Number(this.value);
            vis.yearChange = true;
            vis.updateVis();
        });

        let dropdown = d3
          .select('#select-year')
          .selectAll('option')
          .data(vis.groupedYears)
          .join('option')
            .text(function (d) {
                return d[0];
            })
            .attr('value', function (d) {
                return d[0];
            })
            .property('selected', (d) => {
              return d[0] === vis.selectedYear 
            })

        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);
    }
}
