const approvalFailureTemplate = ({
    employeeName,
    leaveType,
    startDate,
    endDate,
    numberOfDays,
    reason,
    failureReason,
}) => {
    return `
        <p>Hi <strong>${employeeName}</strong>,</p>

        <p>
            We were unable to complete the approval process for your
            <strong>${leaveType}</strong> leave request.
        </p>

        <p>
            Your leave request has been moved back to
            <strong>PENDING</strong> status and requires further review.
        </p>

        <div style="
            background:#fff3cd;
            border:1px solid #ffeeba;
            padding:12px;
            border-radius:4px;
            margin:15px 0;
        ">
            <strong>Failure Reason:</strong><br/>
            ${failureReason}
        </div>

        <p><strong>Leave Request Details:</strong></p>

        <table style="
            border-collapse:collapse;
            width:100%;
        ">
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
            No leave balance has been deducted at this time.
        </p>

        <p>
            Please wait for further updates or contact your manager if you
            need additional information.
        </p>
    `;
};

module.exports = { approvalFailureTemplate };