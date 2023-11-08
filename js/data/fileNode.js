
class FileNode {
    name;
    parentPath;
    /**
     * @type {Array<FileNode>}
     */
    children = [];
    changesCount = 0;

    constructor(name, parentPath) {
        this.name = name;
        this.parentPath = parentPath;
    }

    getFullyQualifiedPath() {
        if (this.parentPath.length === 0) {
            return this.name;
        }

        return this.parentPath + "/" + this.name;
    }

    /**
     * expected: fileName starts with a / for root files
     * @param change {{ fileName: string, modificationType: 'A' | 'M' | 'D' }}
     * @returns FileNode
     */
    applyChange(change) {
        if (change.fileName === name) {
            this.changesCount++;
            return this;
        }

        // process any rename changes from the child name
        const { childName, newChangeName } = this.#processChangeName(change.fileName);
        const child = this.#findOrCreateChild(childName, change.modificationType);

        // if the file has been deleted, remove it as a child
        if (change.modificationType === "D" && !newChangeName) {
            this.children.splice(this.children.indexOf(child), 1);
            return child;
        }

        change.fileName = newChangeName;

        const result = child.applyChange(change);
        this.#removeIfZombie(child);
        return result;
    }

    /**
     * Processes the first component of the provided change name
     * and returns the name of the next child in path, and the remaining
     * path to resolve.
     *
     * @param name
     * @returns {{childName: string, newChangeName: string}}
     */
    #processChangeName(name) {
        let fileSeparatorIndex = this.#getFileSeparatorIndex(name);
        let nextChildName = name.substring(0, fileSeparatorIndex);
        let remainingChangePath = name.substring(fileSeparatorIndex + 1);

        return {
            childName: nextChildName,
            newChangeName: remainingChangePath
        };
    }

    #getFileSeparatorIndex(name) {
        let fileSeparatorIndex = name.indexOf("/");

        if (fileSeparatorIndex === -1) {
            fileSeparatorIndex = name.length;
        }

        return fileSeparatorIndex;
    }

    /**
     * @returns {FileNode}
     */
    #findOrCreateChild(name, modificationType) {
        let child = this.children.find(child => child.name === name);

        if (!child) {
            if (modificationType !== "A") {
                console.warn("File creation for an illegal modification type ", modificationType, name);
            }

            child = new FileNode(name, this.getFullyQualifiedPath());
            this.children.push(child);
        }

        return child;
    }

    /**
     * Called at root level - renames a given file to a new file
     * @param oldName
     * @param newName
     */
    applyRename(oldName, newName) {
        // applied at the root level: first, find and prune node
        const node = this.#findAndPrune(oldName);

        if (node === null) {
            console.warn("Rename attempted on a file that does not exist", oldName, " Treating as addition...");
        }

        // now create the new node
        const newNode = this.applyChange({
            fileName: newName,
            modificationType: "A"
        });

        // add the old changes to the new node
        newNode.changesCount = node?.changesCount ?? 0;
        // transfer children and rename them
        newNode.children = node?.children ?? [];
        // rename all of its children
        newNode.#handleParentRename(newNode.parentPath);
    }

    /**
     * Follows the tree to find the child in the tree and removes it from its parent.
     *
     * @param child
     * @returns {FileNode | null}
     */
    #findAndPrune(child) {
        const { childName, newChangeName: nextName } = this.#processChangeName(child);
        const childNodeIndex = this.children.findIndex(c => c.name === childName);

        if (childNodeIndex === -1) {
            return null;
        }

        const childNode = this.children[childNodeIndex];

        if (!nextName) {
            this.#removeChild(childNode);
            return childNode;
        }

        const result = childNode.#findAndPrune(nextName);
        this.#removeIfZombie(childNode);
        return result;
    }

    #handleParentRename(newParentName) {
        this.parentPath = newParentName;
        this.changesCount++;

        this.children.forEach((child) => {
            child.#handleParentRename(this.getFullyQualifiedPath());
        })
    }

    #removeIfZombie(node) {
        if (node.#isZombie()) {
            this.#removeChild(node);
        }
    }

    #removeChild(node) {
        this.children.splice(this.children.indexOf(node), 1);
    }

    #isZombie() {
        return this.changesCount === 0 && this.children.length === 0;
    }

    /**
     * Utility function to print the file tree, helps debugging
     * @param indent current indentation level of the tree
     */
    print(indent) {
        const indentString = " ".repeat(indent * 2);

        console.log(
            indentString + " -", this.name,
            "mods: " + this.changesCount);

        this.children.forEach(child => child.print(indent + 1));
    }
}
