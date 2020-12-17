export const getArray = (text) => {
    let atext = text.split('\n')
    return atext.filter(item => item.trim().length > 0)
}

export const createLabelsClass = (text) => {
    let aplabels = text.split('\n')
    aplabels = aplabels.filter(item => item.trim().length > 0)
    let labelsl: { [classId: number]: string } = {};
    if (aplabels.length > 0) {
        let classId = aplabels.map((item, i) => i);
        for (let i = 0; i < aplabels.length; i++) {
            if (aplabels[i].trim().length > 0) {
                labelsl[classId[i]] = aplabels[i];
            }
        }
        return labelsl;
    }
}
