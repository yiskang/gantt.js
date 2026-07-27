// js/gantt/utils.js
export const DateHelper = {
    addDays: (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    daysBetween: (date1, date2) => {
        const startDate = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const endDate = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    },
    formatDate: date => date.toISOString().split('T')[0],
    isWeekend: date => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }
};

export const GuidHelper = {
    generateGuid: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};
