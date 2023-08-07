import React, { useCallback, useState } from 'react';
import moment from 'moment';

const StudentApp = () => {
  const [studentList, setStudentList] = useState(
    localStorage.getItem('students')
      ? JSON.parse(localStorage.getItem('students'))
      : []
  );
  const [showCancelModal, setShowCancelModal] = useState(false);

  // does this commit work?

  let handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      let newStudent = {
        name: event.target[0].value,
        dob: event.target[1].value,
      };
      let studentsArr = studentList.slice();
      studentsArr.push(newStudent);
      studentsArr = studentsArr.sort(function (a, b) {
        return new Date(a.dob) - new Date(b.dob);
      });

      localStorage.removeItem('students');
      localStorage.setItem('students', JSON.stringify(studentsArr));
      setStudentList(studentsArr);
    },
    [studentList]
  );

  let reverseSort = useCallback(() => {
    let studentsArr = studentList.slice();
    studentsArr = studentsArr.reverse();
    setStudentList(studentsArr);
  }, [studentList]);

  let showCancel = () => {
    setShowCancelModal(true);
  };

  let clearStudents = () => {
    localStorage.setItem('students', JSON.stringify([]));
    setStudentList([]);
    setShowCancelModal(false);
  };

  return (
    <div
      style={{
        margin: '25px',
        display: 'flex',
        flexDirection: 'column',
        height: '90vh',
        alignItems: 'center',
      }}
    >
      <form
        style={{ display: 'flex', alignItems: 'center' }}
        onSubmit={handleSubmit}
      >
        <label>
          <span style={{ fontSize: '24px', marginRight: '10px' }}>Name: </span>
          <input
            style={{ fontSize: '20px', marginRight: '20px' }}
            type="text"
          />
        </label>
        <label>
          <span style={{ fontSize: '24px', marginRight: '10px' }}>
            Date of Birth:{' '}
          </span>
          <input
            style={{ fontSize: '20px', marginRight: '20px' }}
            type="date"
          />
        </label>
        <button style={{ fontSize: '20px', cursor: 'pointer' }} type="submit">
          Add Student
        </button>
      </form>
      <div
        style={{
          display: 'flex',
          marginTop: '20px',
          marginBottom: '20px',
        }}
      >
        <button
          style={{ cursor: 'pointer', marginRight: '10px', fontSize: '20px' }}
          onClick={reverseSort}
        >
          Reverse Sort
        </button>
        <button
          style={{ cursor: 'pointer', fontSize: '20px' }}
          onClick={showCancel}
        >
          Clear All Students
        </button>
      </div>
      <div style={{ width: '95vw', display: 'flex', flexDirection: 'column' }}>
        {studentList.map((student, index) => (
          <div
            style={{
              display: 'flex',
              fontSize: '26px',
              marginBottom: '10px',
              width: '35%',
            }}
            key={index}
          >
            <div style={{ marginRight: '40px', flex: '1 1 auto' }}>
              {student.name}
            </div>
            <div>{moment(student.dob).format('MM/DD/YYYY')}</div>
          </div>
        ))}
      </div>
      {showCancelModal && (
        <div
          style={{
            width: '550px',
            height: '500px',
            backgroundColor: 'white',
            border: '3px solid gray',
            position: 'absolute',
            zIndex: 500,
            top: `calc(50% - 250px)`,
            left: `calc(50% - 250px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: '1 1 auto',
            }}
          >
            <h1>You are about to clear all students!</h1>
            <h3>Are you sure you want to do this?</h3>
            <h4>Really sure?</h4>
            <h6>Positive?</h6>
          </div>
          <div style={{ display: 'flex', marginBottom: '25px' }}>
            <button
              style={{
                backgroundColor: '#ee0000',
                width: '200px',
                flex: '1 1 auto',
                height: '40px',
                color: 'white',
                fontSize: '20px',
                marginRight: '10px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setShowCancelModal(false);
              }}
            >
              No
            </button>
            <button
              style={{
                backgroundColor: '#0000ee',
                width: '200px',
                height: '40px',
                flex: '1 1 auto',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
              }}
              onClick={clearStudents}
            >
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentApp;
