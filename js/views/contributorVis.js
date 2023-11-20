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

        vis.chart = vis.chartArea.append("g");
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        console.log(this.data.getContributors())

        const authorData = d3.rollup(
            this.data.rawCommits,
            (v) => ({
                totalInsertions: d3.sum(v, (d) => d.insertions),
                totalDeletions: d3.sum(v, (d) => d.deletions),
            }),
            (d) => d.authorName
        );

        vis.authors = Array.from(
            authorData,
            ([authorName, { totalInsertions, totalDeletions }]) => ({
                authorName,
                totalInsertions,
                totalDeletions,
            })
        );

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

        let node = vis.chart
            .selectAll("circle")
            .data(vis.filteredAuthors, (d) => d.authorName)
            .join("circle")
            .attr("r", (d) => vis.scale(d.totalInsertions + d.totalDeletions))
            .attr("fill", (d) => {
                if (selectedContributors.includes(d.authorName)) {
                    return "orange";
                } else {
                    return "#69a2b2";
                }
            })
            .style("fill-opacity", 0.3)
            .attr("stroke", "#69a2b2")
            .style("stroke-width", 4);

        node
            .on("mouseover", (event, d) => {
                d3
                    .select("#tooltip")
                    .style("display", "block")
                    .style("left", event.pageX + vis.config.tooltipPadding + "px")
                    .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
            <div class='tooltip-title'>${d.authorName}</div>
			<div>Additions: <strong>${d.totalInsertions}</strong></div>
			<div>Deletions: <strong>${d.totalDeletions}</strong></div>
          `);
            })
            .on("mouseleave", () => {
                d3.select("#tooltip").style("display", "none");
            });

        node.on("click", (event, d) => {
            if (selectedContributors.includes(d.authorName)) {
                selectedContributors = selectedContributors.filter(function (e) {
                    return e !== d.authorName;
                });
            } else {
                selectedContributors.push(d.authorName);
            }

            vis.dispatcher.call("filterContributors", event, selectedContributors);
        });

        // Everything below was chatGPT
        let simulation = d3
            .forceSimulation(this.filteredAuthors)
            .force(
                "center",
                d3
                    .forceCenter()
                    .x(vis.width / 2)
                    .y(vis.height / 2)
            )
            .force("charge", d3.forceManyBody().strength(1))
            .force(
                "collide",
                d3
                    .forceCollide()
                    .strength(1)
                    .radius((d) => vis.scale(d.totalInsertions + d.totalDeletions))
                    .iterations(1)
            );

        // Update the "cx" and "cy" attributes in the tick function
        simulation.on("tick", function () {
            node
                .attr("cx", (d) =>
                    Math.max(
                        vis.scale(d.totalInsertions + d.totalDeletions),
                        Math.min(
                            vis.width - vis.scale(d.totalInsertions + d.totalDeletions),
                            d.x
                        )
                    )
                )
                .attr("cy", (d) =>
                    Math.max(
                        vis.scale(d.totalInsertions + d.totalDeletions),
                        Math.min(
                            vis.height - vis.scale(d.totalInsertions + d.totalDeletions),
                            d.y
                        )
                    )
                );
        });
    }
}
