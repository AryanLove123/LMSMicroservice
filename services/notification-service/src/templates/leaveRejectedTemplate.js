const rejectionTemplate = ({
    employeeName,
    leaveType,
    startDate,
    endDate,
    numberOfDays,
    reason,
}) => {
    return `
    <p>Hi <strong>${employeeName}</strong>,</p> 
    <p>
        We regret to inform you that your leave request for <strong>${leaveType}</strong> 
        from <strong>${new Date(startDate).toDateString()}</strong> to <strong>${new Date(endDate).toDateString()}</strong> 
        has been rejected.
    </p>
    <p><strong>Details:</strong></p>
    <table style="border-collapse:collapse;width:100%"> 
        <tr>
            <td><strong>Type</strong></td>
            <td>${leaveType}</td>
        </tr>   
        <tr>
            <td><strong>From</strong></td>
            <td>${new Date(startDate).toDateString()}</td>
        </tr>
        <tr>
            <td><strong>To</strong></td>
            <td>${new Date(endDate).toDateString()}</td>
        </tr>
        <tr>
            <td><strong>Days</strong></td>
            <td>${numberOfDays}</td>
        </tr>   
        <tr>
            <td><strong>Reason</strong></td>
            <td>${reason}</td>
        </tr>
    </table>
    <p>
        If you have any questions, please contact your manager.
    </p>
  `;
};

module.exports = { rejectionTemplate };
