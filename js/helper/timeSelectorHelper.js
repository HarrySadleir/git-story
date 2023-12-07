class TimeSelectorHelper {
    constructor() {
        this.maxCount = null;
    }

    /**
     * adds the date object to each object based on unix time
     */
    addCommitDate(data) {
        let commitYearData = data;
        commitYearData.forEach((commit, index) => {
            commitYearData[index].commitDate = new Date(commit.commitTimeUnix * 1000);
        });
        return commitYearData;
    }

    /**
     * checks if the selected year is within the group data and returns it 
     */
    getYearDataIndex(groupedYears, year) {
        for (let i = 0; i < groupedYears.length; i++) {
            if (groupedYears[i][0] === year) return i;
        }
        return -1;
    }

    /**
     * creates the xDomain via creating a dummy calendar year and merging with the existing data for that year
     */
    createXDomain(year, yearData) {
        let yearWeeks = [];
        let fullYearCalendar = this.fillCalendar(year);
        fullYearCalendar = this.mergeDays(fullYearCalendar, yearData);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthObj = {0: 3, 1: 4, 2: 5, 3: 4, 4: 4, 5: 5, 6: 4, 7: 4, 8: 5, 9: 4, 10: 4, 11: 6};
        this.maxCount = d3.max(fullYearCalendar, (d) => d.count);

        // initilize size of first week of year:
        let firstWeekArrSize = new Date(`${year}-01-01`).getDay() === 6 ? 7 : 6 - new Date(`${year}-01-01`).getDay();
        let days = [];
        for (let i = 0; i < firstWeekArrSize; i++) {
            days.push(fullYearCalendar[i]);
        }
        yearWeeks.push(['Jan', days]);
        let weekCounter = 0;
        let dayCounter = firstWeekArrSize;
        for (const month in monthObj) {
          for (let monthWeek = 0; monthWeek < monthObj[month]; monthWeek++) {
            let days = [];
            for (let day = 0; day < 7; day++) {
              const dayInfo = fullYearCalendar[dayCounter];
              if (!dayInfo) {
                  break;
              }
              dayCounter++;
              days.push(dayInfo);
            }
            weekCounter++;
            let janMonthWeekCheck = monthWeek;
            if (month === '0') {
              janMonthWeekCheck = monthWeek + 1;
            }
            yearWeeks.push([`${months[month]}${janMonthWeekCheck === 0 ? '' : janMonthWeekCheck}`, days]);
          }
        }
        return yearWeeks;
    }

    /**
     * returns the largest commit amount for a single day
     */
    getMaxCount() {
        return this.maxCount;
    }

    /**
     * creates default values for each day of the year
     */
    fillCalendar(year) {
        let calendar = [];
        for (let month = 0; month < 12; month++) {
            for (let day = 1; day <= this.daysInMonth(year, month + 1); day++) {
                const date = new Date(`${year}-${month + 1}-${day} 00:00`);
                calendar.push({day: date, count: 0, timeUnix: Math.floor(date.getTime() / 1000)});
            }
        }
        return calendar;
    }

    /**
     * returns how many days for a given month
     */
    daysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }

    /**
     * update days when there is commit data to the default calendar
     */
    mergeDays(fullYearCalendar, yearData) {
        let updatedCalendar = fullYearCalendar;
        yearData.forEach((day) => {
          if (selectedContributors.length === 0  || (selectedContributors.length > 0 && selectedContributors.some(contributor => contributor.name === day.authorName))) {
            const index = fullYearCalendar.findIndex((calendarDay) => {
              return calendarDay.day.getMonth() === day.commitDate.getMonth() && calendarDay.day.getDate() === day.commitDate.getDate();
          });
          updatedCalendar[index].count++;
          }
        });
        return updatedCalendar;
    }

    /**
     * returns the scaled color scheme based on the amount of contributions for that day
     */
    fillBlock(d, contributionIncrement, contributionColor) {
        if (d.count > contributionIncrement * 4) {
            return contributionColor[4];
        } else if (d.count > contributionIncrement * 3) {
            return contributionColor[3];
        } else if (d.count > contributionIncrement * 2) {
            return contributionColor[3];
        } else if (d.count > contributionIncrement * 1) {
            return contributionColor[2];
        } else if (d.count > 1) {
            return contributionColor[1];
        } else {
            return contributionColor[0];
        }
    }

    /**
     * handles the tooltip display hovering a day
     */
    mouseOver(event, d, fullMonths, tooltipLeftPadding, tooltipTopPadding) {
        let count;
        let contribution;
        if (d.count > 1) {
            count = d.count;
            contribution = 'contributions';
        } else if (d.count === 1) {
            count = d.count;
            contribution = 'contribution';
        } else {
            count = 'No';
            contribution = 'contribution';
        }
        const year = d.day.getFullYear();
        const month = fullMonths[d.day.getMonth()];
        const day = d.day.getDate();
        d3
            .select('#tooltip')
            .style('display', 'block')
            .style('left', event.pageX + tooltipLeftPadding + 'px')
            .style('top', event.pageY + tooltipTopPadding + 'px').html(`
        <div>${count} ${contribution} on ${month} ${day}, ${year} </div>
      `);
    }

    /**
     * adds/unselect/resize the selected period, sorts it, and calls dispatch
     */
    selectPeriod(vis, d, selectedPeriod) {
        let tempSelectPeriod = selectedPeriod;
        // check if same value (deselect)
        let isSelected = this.checkDate(d, tempSelectPeriod);
        if (isSelected !== -1) {
            tempSelectPeriod = [];
        } else if (tempSelectPeriod.length < 2) {
            tempSelectPeriod.push(d.day);
            vis.updateVis();
        } else {
            if (d.day < tempSelectPeriod[0] || d.day > tempSelectPeriod[1]) {
              // expand selection
              if (d.day < tempSelectPeriod[0]) {
                  tempSelectPeriod[0] = d.day;
              } else {
                  tempSelectPeriod[1] = d.day;
              }
            } else {
                // shrink selection based on closest endpoint
                let startDiff = Math.abs(d.day - tempSelectPeriod[0]);
                let endDiff = Math.abs(d.day - tempSelectPeriod[1]);
                if (startDiff - endDiff > 0) {
                    tempSelectPeriod[1] = d.day;
                } else {
                    tempSelectPeriod[0] = d.day;
                }
            }
        }
        selectedPeriod = tempSelectPeriod.sort((start, end) => {
            return start - end;
        });
        if (selectedPeriod.length === 2 || selectedPeriod.length === 0) {
            vis.dispatcher.call('filterDates', this, selectedPeriod);
        }
        return selectedPeriod;
    }

    /**
     * checks if a given date matches the same date in the dates array
     */
    checkDate(d, dates) {
        if (dates.length === 0) {
            return -1;
        }
        for (let i = 0; i < dates.length; i++) {
            if (dates[i].getMonth() === d.day.getMonth() && dates[i].getDate() === d.day.getDate()) {
                return i;
            }
        }
        return -1;
    }
}
