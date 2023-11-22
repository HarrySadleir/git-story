class ContributorVis {
    constructor(_config, _dispatcher, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

        // TODO: Add config defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || container.clientWidth,
            containerHeight: _config.containerHeight || container.clientHeight,
            margin: _config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
            tooltipPadding: 15,
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

        vis.chartArea = vis.svg
            .append("g")
            .attr(
                "transform",
                `translate(${vis.config.margin.left},${vis.config.margin.top})`
            );

        vis.colorScale = d3.scaleOrdinal(d3.schemeCategory10);


        vis.chart = vis.chartArea.append("g");
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        vis.authors = this.data.getContributors();

        // Calculate the maximum total insertions and deletions to determine the scaling factor
        const maxTotal = d3.max(
            this.authors,
            (d) => d.totalInsertions + d.totalDeletions
        );

        // Define a scale function to scale down the circle sizes
        vis.scale = d3
            .scalePow()
            .exponent(0.5)
            .domain([0, maxTotal])
            .range([5, 50]);

        const threshold = 0; // Adjust the threshold as needed (if we want fewer circles)

        vis.filteredAuthors = this.authors.filter(
            (d) => d.totalInsertions + d.totalDeletions >= threshold
        );

        vis.renderVis();
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this;

        // Create a hierarchy from the data
        const hierarchyData = d3.hierarchy({ children: vis.filteredAuthors })
            .sum((d) => d.totalInsertions + d.totalDeletions);

        // Use d3.pack() to pack circles
        const pack = d3.pack()
            .size([vis.width, vis.height])
            .padding(5) // Increase padding to spread circles further apart
            .radius((d) => {
                // Set a minimum radius to prevent circles from becoming too small
                return Math.max(5, vis.scale(d.value));
            });

        // Pack the circles and get the updated hierarchy
        const packedData = pack(hierarchyData);

        // Bind data to visual elements (use packedData.descendants() to get the circles)
        let node = vis.chart
            .selectAll("circle")
            .data(packedData.descendants().slice(1)) // Include all descendants
            .join("circle")
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y)
            .attr("r", (d) => vis.scale(d.value))
            .attr("fill", (d) => {
                if (d.data.contributorName) {
                    const index = selectedContributors.findIndex(contributor => contributor.name === d.data.contributorName);
                    if (index !== -1) {
                        // Contributor is already selected, remove it
                        return vis.colorScale(d.data.contributorName)
                    } else {
                        // Contributor is not selected, add it
                        return "white"
                    }
                }
            })
            .style("fill-opacity", 0.3)
            .attr("stroke", "black")
            .style("stroke-width", 1.5);

        node
            .on("mouseover", (event, d) => {
                if (d.data.contributorName) {
                    d3
                        .select("#tooltip")
                        .style("display", "block")
                        .style("left", event.pageX + vis.config.tooltipPadding + "px")
                        .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
                    <div class='tooltip-title'>${d.data.contributorName}</div>
                    <div>Additions: <strong>${d.data.totalInsertions}</strong></div>
                    <div>Deletions: <strong>${d.data.totalDeletions}</strong></div>
                  `);
                }
            })
            .on("mouseleave", () => {
                d3.select("#tooltip").style("display", "none");
            });

        node.on("click", (event, d) => {
            if (d.data.contributorName) {
                const contributorName = d.data.contributorName;
                const color = vis.colorScale(contributorName);
                const contributorObj = { name: contributorName, color: color };

                // Check if contributor is already selected
                const index = selectedContributors.findIndex(contributor => contributor.name === contributorName);

                if (index !== -1) {
                    // Contributor is already selected, remove it
                    selectedContributors.splice(index, 1);
                } else {
                    // Contributor is not selected, add it
                    if (selectedContributors.length < 10) {
                        selectedContributors.push(contributorObj);
                    }
                }

                vis.dispatcher.call("filterContributors", event, selectedContributors);
            }
        });

    }
}
