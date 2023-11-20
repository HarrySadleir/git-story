const SUPPORTED_MODIFICATION_TYPES = ["A", "M", "D", "R"];

class GitData {
    /**
     * @type {Array<{
     *  commitId: string,
     *  authorName: string,
     *  authorEmail: string,
     *  commitTimeUnix: number,
     *  commitMessage: string,
     *  files: Array<{ fileName: string, oldName: string | undefined, modificationType: 'A' | 'M' | 'D' | 'R' }>,
     *  insertions: number,
     *  deletions: number
     *  }>}
     */
    rawCommits;

    constructor(data) {
        this.rawCommits = data.map(commit => {
            commit.commitTimeUnix = +commit.commitTimeUnix;
            commit.files = this.#interpretFilesString(commit.filesModified);
            this.#setSummaryData(commit);
            return commit;
        });
        // go from oldest -> latest
        this.rawCommits.reverse();
    }

    /**
     * @param filesString {string}
     */
    #interpretFilesString(filesString) {
        if (!filesString) {
            return [];
        }

        const files = [];

        for (const match of filesString.matchAll(/\s*(\S)\d*\t([^|]+)\|/gm)) {
            const file = {
                modificationType: match[1],
                fileName: match[2],
                oldName: undefined
            }

            if (SUPPORTED_MODIFICATION_TYPES.indexOf(file.modificationType) === -1) {
                file.modificationType = "M";
            }

            this.#parseFileRenames(file);

            files.push(file);
        }

        return files;
    }

    #parseFileRenames(file) {
        if (file.modificationType !== "R") {
            return;
        }

        // parse file name to have both old + new parts
        const names = file.fileName.split("\t");

        if (names.length !== 2) {
            console.warn("Invalid rename string ", file.fileName);
            return;
        }

        file.fileName = names[1];
        file.oldName = names[0];
    }

    #setSummaryData(commit) {
        if (commit.summary.indexOf("file") === -1) {
            console.warn("Commit summary is invalid", commit.summary);
        }

        const insertionMatch = commit.summary.match(/(\d+) insertion/);
        const deletionMatch = commit.summary.match(/(\d+) deletion/);

        if (insertionMatch) {
            commit.insertions = +insertionMatch[1];
        }

        if (deletionMatch) {
            commit.deletions = +deletionMatch[1];
        }
    }

    /**
     * Produces an array containing all contributors and their number of contributions over the given data.
     * @returns {Array<{contributorName: string, contributorEmails: Array<String>, numContributions: number}>}
     */
    getContributors() {
        const contributors = d3.rollups(this.rawCommits, d => d, d => d.authorName);

        return contributors.map(c => {
            console.log(c)
            return {
                contributorName: c[0],
                contributorEmails: [...new Set(c[1].map(c => c.authorEmail))],
                numContributions: c[1].length
            };
        });
    }

    /**
     * Produces the given data stacked over the given time unit.
     * @param timeUnit {"day" | "week" | "month"}
     * @returns Array<Array<{}>>
     */
    getGroupCommits(timeUnit) {
        return d3.rollups(this.rawCommits, d => d, this.#getCommitKey.bind(this, timeUnit))
            .map(g => [new Date(g[0]), g[1]]);
    }

    #getCommitKey(timeUnit, commit) {
        const date = new Date(commit.commitTimeUnix * 1000);

        if (timeUnit === "day") {
            // erase time data (only date)
            return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        }

        if (timeUnit === "week") {
            // use the start of the week as the key
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).getTime();
        }

        if (timeUnit === "month") {
            // use the 1st of the month
            return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        }
    }

    /**
     *
     * @param date {Date}
     * @returns {FileNode}
     */
    fileTreeAtDate(date) {
        const rootNode = new FileNode(".", "");
        const latestCommitTime = date.getTime() / 1000;

        for (const commit of this.rawCommits) {
            if (commit.commitTimeUnix >= latestCommitTime) {
                break;
            }

            for (const file of commit.files) {
                // handle renames separately
                if (file.modificationType === "R") {
                    rootNode.applyRename(file.oldName, file.fileName);
                    continue;
                }

                rootNode.applyChange({ ...file });
            }
        }

        return rootNode;
    }
}