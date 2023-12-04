class ContributorVis {
    constructor(_config, _dispatcher, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

        // TODO: Add config defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || container.clientWidth,
            containerHeight: _config.containerHeight || container.clientHeight,
            margin: _config.margin || { top: 5, right: 20, bottom: 20, left: 20 },
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

        vis.colorScale = d3.scaleOrdinal(d3.schemeSet1);

        vis.simulation = d3.forceSimulation()
            .force("center", d3.forceCenter(vis.width / 2, vis.height / 2).strength(1.25))
            .force("collide", d3.forceCollide((d) => 5 + (vis.scale(d.totalInsertions + d.totalDeletions))));

        vis.chart = vis.chartArea.append("g");

        vis.suggestionInput = d3.select("#contributor-input");
        vis.suggestionList = d3.select("#contributors");
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
            .range([5, 40]);

        const threshold = 0; // Adjust the threshold as needed (if we want fewer circles)

        vis.filteredAuthors = this.authors.filter(
            (d) => d.totalInsertions + d.totalDeletions >= threshold
        );

        vis.suggestionList.selectAll("option")
            .data(vis.filteredAuthors)
            .join("option")
            .attr("value", d => d.contributorName);

        vis.suggestionInput.on("input", e => {
            if (!vis.filteredAuthors.some(a => a.contributorName === e.target.value)) {
                return;
            }

            this.toggleContributor(e.target.value);
            e.target.value = "";
            e.target.blur();
        })

        vis.renderVis();
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this;

        let node = vis.chart
            .selectAll("circle");

        vis.simulation.stop();

        // update sim
        let old = new Map(node.data().map(d => [d.contributorName, d]));
        vis.filteredAuthors = this.filteredAuthors.map(d => Object.assign(old.get(d.contributorName) || {}, d));

        vis.simulation.nodes(vis.filteredAuthors);

        vis.simulation.alpha(0.05).restart();

        // Bind data to visual elements (use packedData.descendants() to get the circles)
        node = node
            .data(vis.filteredAuthors)
            .join("circle")
            .attr("r", (d) => vis.scale(d.totalInsertions + d.totalDeletions))
            .attr("fill", (d) => {
                if (d.contributorName) {
                    const index = selectedContributors.findIndex(contributor => contributor.name === d.contributorName);
                    if (index !== -1) {
                        // Contributor is already selected, remove it
                        return vis.colorScale(d.contributorName)
                    } else {
                        // Contributor is not selected, add it
                        return "white"
                    }
                }
            })
            .style("fill-opacity", 0.8)
            .attr("stroke", "black")
            .style("stroke-width", 1.5);

        vis.simulation.on("tick", () => {
            node.attr("cx", d => {
                const radius = vis.scale(d.totalInsertions + d.totalDeletions);

                d.x = Math.max(
                    radius,
                    Math.min(
                        vis.width - radius,
                        d.x
                    )
                );

                return d.x
            });

            node.attr("cy", d => {
                const radius = vis.scale(d.totalInsertions + d.totalDeletions);

                d.y = Math.max(
                    radius,
                    Math.min(
                        vis.height - radius,
                        d.y
                    )
                );

                return d.y
            })
        });

        node
            .on("mouseover", (event, d) => {
                if (d.contributorName) {
                    d3
                        .select("#tooltip")
                        .style("display", "block")
                        .style("left", event.pageX + vis.config.tooltipPadding + "px")
                        .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
                    <div class='tooltip-title'>${d.contributorName}</div>
                    <div>Additions: <strong>${d.totalInsertions}</strong></div>
                    <div>Deletions: <strong>${d.totalDeletions}</strong></div>
                    <br/>
                    <i>Click to toggle the contributor</i>
                  `);
                }
            })
            .on("mouseleave", () => {
                d3.select("#tooltip").style("display", "none");
            });

        node.on("click", (event, d) => {
            if (d.contributorName) {
                const contributorName = d.contributorName;
                this.toggleContributor(contributorName);
            }
        });

    }

    toggleContributor(contributorName) {
        const color = this.colorScale(contributorName);
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

        this.dispatcher.call("filterContributors", event, selectedContributors);
    }
}
