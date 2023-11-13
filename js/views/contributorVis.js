class ContributorVis {
  constructor(_config, _dispatcher, _data) {
    // TODO: Add config defaults
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 1000,
      containerHeight: _config.containerHeight || 600,
      margin: _config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
    };
    this.dispatcher = _dispatcher;
    this.data = _data;

    this.selectedContributors = [];
    this.initVis();
  }

  /**
   * Initialize scales/axes and append static chart elements
   */
  initVis() {
    let vis = this;

    const authorData = d3.rollup(
      this.data.rawCommits,
      (v) => ({
        totalInsertions: d3.sum(v, (d) => d.insertions),
        totalDeletions: d3.sum(v, (d) => d.deletions),
      }),
      (d) => d.authorName
    );

    const authors = Array.from(
      authorData,
      ([authorName, { totalInsertions, totalDeletions }]) => ({
        authorName,
        totalInsertions,
        totalDeletions,
      })
    );

    vis.width =
      vis.config.containerWidth -
      vis.config.margin.left -
      vis.config.margin.right;
    vis.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);
    // TODO: Implement

    vis.chartArea = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left},${vis.config.margin.top})`
      );
    vis.chart = vis.chartArea.append("g");

    // Calculate the maximum total insertions and deletions to determine the scaling factor
    const maxTotal = d3.max(
      authors,
      (d) => d.totalInsertions + d.totalDeletions
    );

    // Define a scale function to scale down the circle sizes
    // const scale = d3.scaleLinear().domain([0, maxTotal]).range([5, 100]); // Adjust the range for circle sizes
	const scale = d3.scalePow().exponent(0.5).domain([0, maxTotal]).range([5, 100]); 

    const threshold = 0; // Adjust the threshold as needed

    const filteredAuthors = authors.filter(
      (d) => d.totalInsertions + d.totalDeletions >= threshold
    );

    // Update the "r" attribute in the node creation
    let node = vis.chart
      .selectAll("circle")
      .data(filteredAuthors)
      .enter()
      .append("circle")
      .attr("r", (d) => scale(d.totalInsertions + d.totalDeletions))
      .style("fill", "#69b3a2")
      .style("fill-opacity", 0.3)
      .attr("stroke", "#69a2b2")
      .style("stroke-width", 4);

    // Increase the strength of the forceCollide
    let simulation = d3
      .forceSimulation(filteredAuthors) // Use the filtered data for simulation
      .force(
        "center",
        d3
          .forceCenter()
          .x(vis.width / 2)
          .y(vis.height / 2)
      )
      .force("charge", d3.forceManyBody().strength(1.5)) // Adjust strength
      .force(
        "collide",
        d3
          .forceCollide()
          .strength(1) // Adjust strength
          .radius((d) => scale(d.totalInsertions + d.totalDeletions))
          .iterations(1)
      );

    // Calculate the maximum radius of all circles
    const maxRadius = d3.max(authors, (d) =>
      scale(d.totalInsertions + d.totalDeletions)
    );

    // Set initial positions from the center outward without overlapping
    authors.forEach((d, i) => {
      const angle = (i / authors.length) * 2 * Math.PI; // Calculate angle based on the number of circles
      d.x = vis.width / 2 + maxRadius * Math.cos(angle);
      d.y = vis.height / 2 + maxRadius * Math.sin(angle);
    });

    // Update the "cx" and "cy" attributes in the tick function
    simulation.on("tick", function () {
      node
        .attr("cx", (d) =>
          Math.max(
            scale(d.totalInsertions + d.totalDeletions),
            Math.min(
              vis.width - scale(d.totalInsertions + d.totalDeletions),
              d.x
            )
          )
        )
        .attr("cy", (d) =>
          Math.max(
            scale(d.totalInsertions + d.totalDeletions),
            Math.min(
              vis.height - scale(d.totalInsertions + d.totalDeletions),
              d.y
            )
          )
        );
    });
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
