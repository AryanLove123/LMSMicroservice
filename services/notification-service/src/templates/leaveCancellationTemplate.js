const cancellationTemplate = ({
    employeeName,
    leaveType,
    startDate,
    endDate,
    numberOfDays,
    previousStatus, // Pending | Approved
}) => {
    return `
    <p>Hi <strong>${employeeName}</strong>,</p>

    <p>
        This is to confirm that your <strong>${leaveType}</strong> leave request
        scheduled from <strong>${new Date(startDate).toDateString()}</strong>
        to <strong>${new Date(endDate).toDateString()}</strong>
        has been successfully cancelled.
    </p>

    <p><strong>Cancellation Details:</strong></p>

    <table style="border-collapse:collapse;width:100%">
        <tr>
            <td><strong>Leave Type</strong></td>
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
            <td><strong>Number of Days</strong></td>
            <td>${numberOfDays}</td>
        </tr>
        <tr>
            <td><strong>Previous Status</strong></td>
            <td>${previousStatus}</td>
        </tr>
    </table>

    <p>
        ${
            previousStatus.toLowerCase() === 'approved'
                ? 'If any leave balance was deducted for this approved leave request, it will be restored to your leave balance shortly.'
                : 'Since this leave request was still pending approval, no leave balance deduction has been made.'
        }
    </p>

    <p>
        If you have any questions regarding your leave balance or cancellation,
        please contact your manager or HR team.
    </p>

    <p>
        Thank you.
    </p>
  `;
};

module.exports = { cancellationTemplate };