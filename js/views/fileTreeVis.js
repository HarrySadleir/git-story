class FileTreeVis {

    /**
     *
     * @param _config
     * @param _data {GitData}
     */
	constructor(_config, _data) {
        const container = document.getElementById(_config.parentElement.substring(1));

		// TODO: Add config defaults
		this.config = {
			parentElement: _config.parentElement,
			containerWidth: _config.containerWidth || container.clientWidth,
			containerHeight: _config.containerHeight || container.clientHeight,
			margin: _config.margin || {top: 20, right: 20, bottom: 20, left: 20}
		};
		this.initVis();
        this.updateData(_data);
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

        vis.colorScale = d3.scaleOrdinal(d3.schemeTableau10);

        vis.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.data.getFullyQualifiedPath())
                .distance(l => vis.rScale(l.source.data.getChangesCount()) + vis.rScale(l.target.data.getChangesCount()))
                .strength(1))
            .force("charge", d3.forceManyBody().strength(d => -(vis.rScale(d.data.getChangesCount()) * 10)))
            .force("collide", d3.forceCollide((d) => 20 + vis.rScale(d.data.getChangesCount())))
            .force("x", d3.forceX().strength(0.3))
            .force("y", d3.forceY().strength(0.3));

		// TODO: Implement
	}

    updateData(_data) {
        this.data = _data;

        const fileTree = data.fileTreeAtDate(new Date());

        this.rScale = d3.scaleSqrt()
            .domain([0, fileTree.getChangesCount()])
            .range([40, this.width / 3]);

        fileTree.expandIfAtDepth(0, 0);
        this.fileTree = fileTree;
    }

	/**
	 * Prepare the data and scales before we render it.
	 */
	updateVis() {
		let vis = this;

        const root = d3.hierarchy(this.fileTree);
        const nodes = root.descendants()
            .filter(n => n.data.expanded);
        const links = root.links().filter(l => nodes.indexOf(l.target) !== -1);

		// TODO: Implement
		vis.renderVis(links, nodes);
	}

	/**
	 * Bind data to visual elements
	 */
	renderVis(links, nodes) {
		let vis = this;

        vis.simulation?.stop();

        // TODO: preserve old position and velocity in new sim: https://observablehq.com/@d3/modifying-a-force-directed-graph
        //vis.simulation = ;

        let link = vis.linksGroup.selectAll("line");

        let node = vis.nodesGroup
            .selectAll(".node-group");
            // .attr("fill", d => null)
            // .attr("stroke", d => d.children ? null : "#fff")
            // .attr("r", d => vis.rScale(d.data.getChangesCount()));

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
        vis.simulation.alpha(1).restart();

        node = node.data(nodes, n => n.data.getFullyQualifiedPath())
            .join("g")
            .attr("class", "node-group")
            .attr("id", d => d.data.getFullyQualifiedPath());

        link = link
            .data(links)
            .join("line");

        const innerCircleGroup = node
            .selectAll(".inner-circle")
            .data(d => {
                const radius = vis.rScale(d.data.getChangesCount());
                const innerHierarchy = d3.hierarchy(d.data.createInnerHierarchyNode(0, 3))
                    .sum(d => d.changesCount)
                    .sort((a, b) => b.value - a.value);
                const pack = d3.pack()
                    .size([2*radius, 2*radius])
                    .padding(5);
                const root = pack(innerHierarchy);

                return root.descendants();
            })
            .join("g")
            .attr("class", "inner-circle")
            .attr("id", d => d.data.data.getFullyQualifiedPath());

        innerCircleGroup
            .selectAll("circle")
            .data(d => [d])
            .join("circle")
            .attr("fill", d => d.data.data.isDirectory() ? null : vis.colorScale(d.data.name.substring(d.data.name.lastIndexOf("."))))
            .attr("stroke", "black")
            .attr("r", d => d.r)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .on("click", (e, d) => {
                if (!d.data.data.isDirectory() || d.data.name === "." || d.depth > 1) {
                    return;
                }

                d.data.data.toggleExpanded();
                this.updateVis();
            });

        innerCircleGroup
            .selectAll("title")
            .data(d => [d])
            .join("title")
            .text(d => d.data.data.getFullyQualifiedPath());

        innerCircleGroup
            .selectAll(".inner-title")
            // todo: figure logic out here for titles
            .data(d => (d.r >= (d.data.name.length * 3) && d.data.depth !== 0) ? [d] : [])
            .join("text")
            .attr("class",  "inner-title")
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
            .text(d => d.data.name);

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

		// TODO: Implement
	}
}
