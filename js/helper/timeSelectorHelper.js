class TimeSelectorHelper {
  constructor() {
    this.maxCount = null;
  }

  addCommitDate(data) {
    let commitYearData = data;
    commitYearData.forEach((commit, index) => {
      commitYearData[index].commitDate = new Date(commit.commitTimeUnix * 1000);
    });
    return commitYearData;
  }

  getYearDataIndex(groupedYears, year) {
    for (let i = 0; i < groupedYears.length; i++) {
      if (groupedYears[i][0] === year) return i;
    }
    return -1;
  }

  createXDomain(year, yearData) {
    let yearWeeks = [];
    let fullYearCalendar = this.fillCalendar(year);
    fullYearCalendar = this.mergeDays(fullYearCalendar, yearData);

    this.maxCount = d3.max(fullYearCalendar, (d) => d.count);
    // initilize size of first week of year:
    let firstWeekArrSize = new Date(`${year}-01-01`).getDay() === 6 ? 7 : 6 - new Date(`${year}-01-01`).getDay();
    let days = [];
    for (let i = 0; i < firstWeekArrSize; i++) {
      days.push(fullYearCalendar[i]);
    }
    yearWeeks.push(['week0', days]);
    for (let week = 0; week < 52; week++) {
      days = [];
      for (let day = 0; day < 7; day++) {
        const dayInfo = fullYearCalendar[day + week * 7 + firstWeekArrSize];
        if (!dayInfo) {
          break;
        }
        days.push(dayInfo);
      }
      yearWeeks.push([`week${week + 1}`, days]);
    }
    return yearWeeks;
  }

  getMaxCount() {
    return this.maxCount;
  }

  fillCalendar(year) {
    let calendar = [];
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= this.daysInMonth(year, month + 1); day++) {
        const date = new Date(`${year}-${month + 1}-${day} 00:00`);
        calendar.push({ day: date, count: 0, timeUnix: Math.floor(date.getTime() / 1000) });
      }
    }
    return calendar;
  }

  daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  mergeDays(fullYearCalendar, yearData) {
    let updatedCalendar = fullYearCalendar;
    yearData.forEach((day) => {
      const index = fullYearCalendar.findIndex((calendarDay) => {
        return calendarDay.day.getMonth() === day.commitDate.getMonth() && calendarDay.day.getDate() === day.commitDate.getDate();
      });
      updatedCalendar[index].count++;
    });
    return updatedCalendar;
  }

  fillBlock(d, contributionIncrement, contributionColor) {
    let vis = this;
    if (d.count >= contributionIncrement * 4) {
      return contributionColor[4];
    } else if (d.count >= contributionIncrement * 3) {
      return contributionColor[3];
    } else if (d.count >= contributionIncrement * 2) {
      return contributionColor[3];
    } else if (d.count >= contributionIncrement * 1) {
      return contributionColor[2];
    } else if (d.count >= 1) {
      return contributionColor[1];
    } else {
      return contributionColor[0];
    }
  }

  mouseOver(event, d, fullMonths, tooltipLeftPadding, tooltipTopPadding) {
    let vis = this;
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
      .select('#time-selector-tooltip')
      .style('display', 'block')
      .style('left', event.pageX + tooltipLeftPadding + 'px')
      .style('top', event.pageY + tooltipTopPadding + 'px').html(`
        <div>${count} ${contribution} on ${month} ${day}, ${year} </div>
      `);
  }

  selectPeriod(vis, d, selectedPeriod) {
    let tempSelectPeriod = selectedPeriod;
    if (tempSelectPeriod.length < 2) {
      tempSelectPeriod.push(d.day);
      vis.updateVis();
    } else {
      // check if same value (deselect)
      let isSelected = this.checkDate(d, tempSelectPeriod);
      if (isSelected !== -1) {
        tempSelectPeriod = [];
      } else if (d.day < tempSelectPeriod[0] || d.day > tempSelectPeriod[1]) {
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
