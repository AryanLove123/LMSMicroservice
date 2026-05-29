const employeeTemplate = ({
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
      Your <strong>${leaveType} leave</strong>
      application has been submitted.
    </p>

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
  `;
};

const managerTemplate = ({
  employeeName,
  leaveType,
  startDate,
  endDate,
  numberOfDays,
  reason,
}) => {
  return `
    <p>Hi,</p>
    <p>
      <strong>${employeeName}</strong>
      applied for <strong>${leaveType} leave</strong> and is awaiting your approval.
    </p>
    <table style="border-collapse:collapse;width:100%">
        <tr>
            <td><strong>Employee</strong></td>
            <td>${employeeName}</td>
        </tr>
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
      Please log in to the Leave Management Portal to approve or reject this leave request.
    </p>
    <p>
      Thank you.
    </p>
  `;
};

module.exports = { employeeTemplate, managerTemplate};
