class TimeSelectorVis {
  constructor(_config, _dispatcher, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 120,
      margin: _config.margin || { top: 30, right: 20, bottom: 10, left: 30 },
    };
    this.dispatcher = _dispatcher;
    this.helper = new TimeSelectorHelper();
    this.data = this.helper.addCommitDate(_data.rawCommits);
    this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.contributionColor = ['#EBEDF0', '#9BE9A8', '#41C463', '#30A14E', '#216E39'];
    this.tooltipLeftPadding = -50;
    this.tooltipTopPadding = -30;
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

    vis.yScale = d3.scaleBand().range([0, vis.height]);
    vis.xScale = d3.scaleBand().range([0, vis.width]);
    vis.xAxis = d3.axisTop(vis.xScale).tickSize(0).tickValues([]);
    vis.yAxis = d3.axisLeft(vis.yScale).tickSize(0).tickValues(['Mon', 'Wed', 'Fri']);
    vis.xAxisG = vis.chart.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0,${vis.height})`);
    vis.yAxisG = vis.chart.append('g').attr('class', 'axis y-axis time-selector-y-axis');
    vis.svg.append('text').attr('class', 'axis-title').attr('x', 250).attr('y', 0).attr('dy', '.71em').text('Contributions');
    vis.MonthLabels = vis.chart
      .selectAll('.months-label')
      .data(this.months)
      .join('text')
      .attr('class', 'months-label')
      .attr('x', (d) => {
        const monthIndex = this.months.indexOf(d);
        return monthIndex * 46;
      })
      .attr('y', -5)
      .text((d) => d);

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
        return `translate(${colorIndex * 10.5}, 82)`;
      });
    vis.svg
      .append('text')
      .attr('class', 'contribution-label')
      .attr('x', vis.config.containerWidth - 95)
      .attr('y', 118)
      .text('Less');
    vis.svg
      .append('text')
      .attr('class', 'contribution-label')
      .attr('x', vis.config.containerWidth - 26)
      .attr('y', 118)
      .text('More');

    vis.groupedYears = d3.groups(this.data, (d) => d.commitDate.getFullYear());
    let dropdown = d3
      .select('#select-year')
      .selectAll('yearOptions')
      .data(vis.groupedYears)
      .enter()
      .append('option')
      .text(function (d) {
        return d[0];
      })
      .attr('value', function (d) {
        return d[0];
      });
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;
    let selectedYear = vis.selectedYear ? vis.selectedYear : vis.groupedYears[0][0];
    const selectYearIndex = this.helper.getYearDataIndex(vis.groupedYears, selectedYear);
    vis.selectedYearData = vis.groupedYears[selectYearIndex][1];
    vis.xValue = (d) => d[0];
    vis.yValue = (d) => this.week[d.day.getDay()];
    vis.groupedWeekData = this.helper.createXDomain(selectedYear, vis.selectedYearData);
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
      .attr('width', 6)
      .attr('height', 6)
      .attr('rx', 1)
      .attr('fill', (d) => this.helper.fillBlock(d, vis.contributionIncrement, this.contributionColor))
      .classed('time-selector-active', (d) => this.helper.checkDate(d, this.selectedPeriod) !== -1)
      .on('mouseover', (event, d) => this.helper.mouseOver(event, d, this.fullMonths, vis.tooltipLeftPadding, vis.tooltipTopPadding))
      .on('mouseleave', () => {
        d3.select('#time-selector-tooltip').style('display', 'none');
      })
      .on('click', (event, d) => {
        this.selectedPeriod = this.helper.selectPeriod(vis, d, this.selectedPeriod);
      });

    d3.select('#select-year').on('change', function (d) {
      vis.selectedYear = Number(this.value);
      vis.updateVis();
    });

    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);
  }
}
