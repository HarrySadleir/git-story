class FileTreeVis {

    /**
     *
     * @param _config
     * @param _data {GitData}
     */
    constructor(_config, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || container.clientWidth,
            containerHeight: _config.containerHeight || container.clientHeight,
            margin: _config.margin || {top: 20, right: 20, bottom: 20, left: 20},
            tooltipPadding: 15,
        };
        this.initVis();
        this.updateData(_data, true);
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
            .attr('height', vis.config.containerHeight)
            .attr("viewBox", [-vis.width / 2, -vis.height / 2, vis.width, vis.height]);

        vis.linksGroup = vis.svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6);

        vis.nodesGroup = vis.svg.append("g")
            .attr("fill", "#fff")
            .attr("stroke", "#000")
            .attr("stroke-width", 1.5);

        vis.svg.append("text")
            .attr("id", "viz-title")
            .attr("x", 0)
            .attr("y", 24 - vis.height / 2)
            .attr("font-size", "24")
            .attr("fill", "black")
            .attr("text-anchor", "middle")
            .text("File Tree - Sized by Commit Count");

        vis.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.data.getFullyQualifiedPath())
                .distance(l => vis.rScale(l.source.data.getChangesCount()) + vis.rScale(l.target.data.getChangesCount()))
                .strength(1))
            .force("charge", d3.forceManyBody().strength(d => -(vis.rScale(d.data.getChangesCount()))))
            .force("collide", d3.forceCollide((d) => 20 + vis.rScale(d.data.getChangesCount())))
            .force("x", d3.forceX().strength(0.5))
            .force("y", d3.forceY().strength(0.3))
            .force("levelY", d3.forceY(vis.height / 2).strength((d) => Math.min(1, d.depth / 5)));
    }

    updateData(_data, newDates) {
        this.data = _data;

        let fileTree;

        if (newDates) {
            if (dateRange.length > 0) {
                fileTree = data.fileTreeAtDate(dateRange[0], dateRange[1])
            } else {
                fileTree = data.fileTreeAtDate(new Date(0), new Date())
            }
        } else {
            fileTree = this.fileTree;
        }

        this.rScale = d3.scaleSqrt()
            .domain([0, fileTree.getChangesCount()])
            .range([40, this.width / 3.5]);

        fileTree.expandIfAtDepth(0, 0);
        this.fileTree = fileTree;
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        const root = d3.hierarchy(this.fileTree);
        const nodes = root.descendants().filter(n => n.data.expanded && n.data.isVisible());
        const links = root.links().filter(l => nodes.indexOf(l.target) !== -1);

        vis.linkScale = d3.scaleLinear()
            .domain([0, d3.max(nodes.map(n => n.depth))])
            .range([5, 0]);

        const fileTypes = d3.rollups(
            nodes.flatMap(n => d3.hierarchy(n.data.createInnerHierarchyNode(0, 4))
                .descendants()
                .filter(n => !n.data.data.isDirectory())),
            (v) => v,
            d => d.data.name.substring(d.data.name.lastIndexOf("."))
        )
            .map((arr) => [arr[0], arr[1].length])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6) // take the top 6 file types
            .map((arr) => arr[0]);

        vis.colorScale = d3.scaleOrdinal(d3.schemeSet3)
            .domain(fileTypes)
            .unknown("#555555");

        vis.renderVis(links, nodes);
    }

    /**
     * Bind data to visual elements
     */
    renderVis(links, nodes) {
        let vis = this;

        vis.simulation?.stop();

        let link = vis.linksGroup.selectAll("line");

        let node = vis.nodesGroup
            .selectAll(".node-group");

        // update simulation
        let old = new Map(node.data().map(d => [d.data.getFullyQualifiedPath(), d]));
        nodes = nodes.map(d => Object.assign(old.get(d.data.getFullyQualifiedPath()) || {}, d));
        old = new Map(nodes.map(d => [d.data.getFullyQualifiedPath(), d]));
        links = links.map(d => Object.assign(d, {
            source: old.get(d.source.data.getFullyQualifiedPath()),
            target: old.get(d.target.data.getFullyQualifiedPath())
        }));

        vis.simulation.nodes(nodes);
        vis.simulation.force("link").links(links);
        vis.simulation.alpha(0.10).restart();

        node = node.data(nodes, n => n.data.getFullyQualifiedPath())
            .join("g")
            .attr("class", "node-group")
            .attr("id", d => d.data.getFullyQualifiedPath());

        link = link
            .data(links)
            .join("line")
            .attr("stroke-width", l => vis.linkScale(l.source.depth));

        const innerCircleGroup = node
            .selectAll(".inner-circle")
            .data(d => {
                const radius = vis.rScale(d.data.getChangesCount());
                const innerHierarchy = d3.hierarchy(d.data.createInnerHierarchyNode(0, 3))
                    .sum(d => d.changesCount)
                    .sort((a, b) => b.value - a.value);
                const pack = d3.pack()
                    .size([2 * radius, 2 * radius])
                    .padding(5);
                const root = pack(innerHierarchy);

                return root.descendants();
            }, d => d.data.data.getFullyQualifiedPath())
            .join("g")
            .attr("class", "inner-circle")
            .attr("id", d => d.data.data.getFullyQualifiedPath());

        innerCircleGroup
            .selectAll("circle")
            .data(d => [d])
            .join("circle")
            .attr("fill", d => d.data.data.isDirectory() ? null : vis.colorScale(d.data.name.substring(d.data.name.lastIndexOf("."))))
            .attr("stroke", d => d.data.name === "." ? "green" : "black")
            .attr("r", d => d.r)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .on("click", (e, d) => {
                if (!d.data.data.isDirectory() || d.data.name === "." || d.depth > 1) {
                    return;
                }

                d.data.data.toggleExpanded();
                this.updateVis();
            })
            .on("mouseover", (event, d) => {
                let hoverColor;

                if (d.data.data.isDirectory()) {
                    hoverColor = 'rgb(193, 193, 193)';
                } else {
                    const color = vis.colorScale(d.data.name.substring(d.data.name.lastIndexOf("."))).toString();
                    const r = parseInt(color.slice(1, 3), 16) - 50;
                    const g = parseInt(color.slice(3, 5), 16) - 50;
                    const b = parseInt(color.slice(5, 7), 16) - 50;
                    hoverColor = `rgb(${r},${g},${b})`;
                }

                if (d.depth <= 1) {
                    d3.select(event.currentTarget).attr('fill', hoverColor);
                }

                d3
                    .select("#tooltip")
                    .style("display", "block")
                    .style("left", event.pageX + vis.config.tooltipPadding + "px")
                    .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
                      <div class='tooltip-title'>${d.data.name}</div>
                      <p>
                        <b>Parent:</b> ${d.data.data.parentPath ?? "None"} <br/>
                        <b># of Commits:</b> ${d.data.data.getChangesCount()}
                      </p>
                      ${(d.data.data.isDirectory() && d.data.name !== "." && d.depth <= 1) ?
                    `<i>Click to ${d.depth === 0 ? "close" : "expand"} directory</i>` : ""}
              `);
            })
            .on("mousemove", (event, d) => {
                d3
                    .select("#tooltip")
                    .style("display", "block")
                    .style("left", event.pageX + vis.config.tooltipPadding + "px")
                    .style("top", event.pageY + vis.config.tooltipPadding + "px")
            })
            .on('mouseleave', (event, d) => {
                d3.select('#tooltip').style('display', 'none');
                d3.select(event.currentTarget).attr('fill', d => d.data.data.isDirectory() ? null : vis.colorScale(d.data.name.substring(d.data.name.lastIndexOf("."))))
            })

        innerCircleGroup
            .selectAll(".inner-title")
            .data(d => (d.r >= (d.data.name.length * 3) && (!d.data.data.isDirectory() || d.depth === 3)) ? [d] : [])
            .join("text")
            .attr("class", "inner-title")
            .attr("font-size", "12")
            .attr("fill", "black")
            .attr("stroke-width", "0")
            .attr("text-anchor", "middle")
            .attr("x", d => d.x)
            .attr("y", d => d.y + 2.5)
            .text(d => d.data.name);

        node
            .selectAll(".outer-title")
            .data(d => [d])
            .join("text")
            .attr("class", "outer-title")
            .attr("fill", "black")
            .attr("stroke-width", "0")
            .attr("text-anchor", "middle")
            .attr("x", d => vis.rScale(d.data.getChangesCount()))
            .attr("y", -5)
            .text(d => d.depth === 0 ? "Root Folder" : d.data.name);

        // legend
        const fileTypes = [...vis.colorScale.domain(), "Other"].reverse();
        const legendWidth = d3.max(fileTypes.map(e => e.length * 16 + 12));
        const legendGroup = vis.svg.selectAll(".legend")
            .data([fileTypes])
            .join("g")
            .attr("class", "legend")
            .attr("transform", d =>
                `translate(${vis.width / 2 - legendWidth - 18}, ${-vis.height / 2 + d.length * 24 + 18})`);

        legendGroup.selectAll(".legend-border")
            .data(d => [d])
            .join("rect")
            .attr("class", ".legend-border")
            .attr("fill", "transparent")
            .attr("x", -10)
            .attr("y", d => -((d.length) * 24 + 14))
            .attr("width", legendWidth)
            .attr("height", d => d.length * 24 + 36)
            .attr("stroke", "rgb(222, 222, 222)");

        legendGroup.selectAll(".legend-title")
            .data(d => [d])
            .join("text")
            .attr("class", "legend-title")
            .attr("fill", "#333333")
            .attr("stroke-width", "0")
            .attr("font-size", 16)
            .attr("text-anchor", "middle")
            .attr("y", d => -((d.length) * 24) + 6)
            .attr("x", legendWidth / 2 - 10)
            .text("File Types");

        const legendItem = legendGroup.selectAll(".legend-item")
            .data(d => d)
            .join("g")
            .attr("class", "legend-item")
            .attr("transform", (_, i) => `translate(0, -${i * 24})`);

        legendItem.selectAll("circle")
            .data(d => [d])
            .join("circle")
            .attr("r", 8)
            .attr("stroke", "black")
            .attr("fill", vis.colorScale);

        legendItem.selectAll("text")
            .data(d => [d])
            .join("text")
            .attr("fill", "#333333")
            .attr("stroke-width", "0")
            .attr("x", 12)
            .attr("y", 4)
            .text(d => d);

        vis.simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => {
                const radius = vis.rScale(d.data.getChangesCount());

                d.x = Math.max(
                    (-vis.width / 2) + radius,
                    Math.min(
                        (vis.width / 2) - radius,
                        d.x
                    )
                );

                d.y = Math.max(
                    (-vis.height / 2) + radius,
                    Math.min(
                        (vis.height / 2) - radius,
                        d.y
                    )
                );

                const bottomX = d.x - radius;
                const bottomY = d.y - radius;

                return `translate(${bottomX}, ${bottomY})`
            });
        });
    }
}
