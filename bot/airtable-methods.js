//** This file handles Airtable operations* /

var Airtable = require('airtable');
require('dotenv').config("./env");

var base = new Airtable({ apiKey: process.env.apiKey }).base(process.env.base);

/**
 * @param {string} id - Unique User ID of the students.
 * @param {string} name - Student name
 */
const createRecord = async (userID, name) => {

  const students = await base('MS-Students').select({
    filterByFormula: `Phone = '${userID}'`,
    view: "Grid view"
  }).all();
  var len = students.length;
  // console.log(len)
  return new Promise((resolve, reject) => {
    if (len == 0) {

      base('MS-Students').create([
        {
          "fields": {
            "Phone": userID,
            "Name": name,
            "Course": "WomenWill",
            "Module Completed": 0,
            "Next Module": 1,
            "Day Completed": 0,
            "Next Day": 1
          }
        }
      ], function (err, records) {
        if (err) {
          console.error(err);
          reject(err);
        }
        else {

          resolve("Successfully registered")
        }

      });

    }
    else {
      resolve("Already registered")
    }
  })

}

/**
 * Update the column in Airtable.
 * @param {string} id - Unique row ID
 * @param {string} field_name - Field name to update
 * @param {*} updatedValue - Value to update
 */
async function updateField(id, field_name, updatedValue) {

  base('MS-Students').update([

    {
      "id": id,
      "fields": {
        [field_name]: updatedValue
      }
    }
  ], function (err, records) {
    if (err) {
      // throw new Error(err)
      console.log(err);
      // return;
    }

  });
}

async function updateName(id, field_name, updatedValue) {

  base('MS-Students').update([

    {
      "id": id,
      "fields": {
        [field_name]: updatedValue
      }
    }
  ], function (err, records) {
    if (err) {
      console.log(err);
    }

  });
}

/**
 * Find total days in a given course.
 * @param {string} number - Unique User ID of the students.
 * @returns total days 
 */
const totalDays = async (number) => {

  var course_tn = await findTable(number)
  const course_table = await base(course_tn).select({
    fields: ["Day"],
    view: "Grid view"
  }).all();
  return new Promise((resolve, reject) => {
    count = 0

    course_table.forEach(function (record) {
      count += 1

    })
    console.log(count)
    resolve(count)
    reject("Error")
  })
}

/** 
 * Finds the course table of individual students.
 * Note: Course name and Course table name must be same.
 * @param {string} number - Unique User ID of the students.
 * @returns course name 
 */
const findTable = async (number) => {

  const course_table = await base('MS-Students').select({
    filterByFormula: `({Phone} = '${number}' )`,
    view: "Grid view"
  }).all();

  return new Promise((resolve, reject) => {
    course_tn = ""
    course_table.forEach(function (record) {
      course_tn = record.get("Course")
      resolve(course_tn)
      reject("error")

    })
  })
}

/**
 * Find the current value in Response column
 * @param {string} id - Unique row id 
 * @returns Response field value for given ID.
 */
const findRecord = async (id) => {
  return new Promise((resolve, reject) => {
    base('MS-Students').find(id, function (err, record) {
      if (err) { console.error(err); return; }

      resolve(record.fields.Response);
    });
  }
  )
}

/**
 * Find the Title and list options for a given module number
 * @param {number} currentDay 
 * @param {number} module_no 
 * @returns List title and options for the particular module number
 */
const findTitle = async (number, currentDay, module_no) => {
  let course_tn = await findTable(number)
  const records = await base(course_tn).select({
    filterByFormula: "({Day} =" + currentDay + ")",
    view: "Grid view",

  }).all(
  );
  return new Promise((resolve, reject) => {
    records.forEach(function (record) {
      let title = record.get('Module ' + module_no + ' LTitle');
      let options = record.get('Module ' + module_no + ' List');
      if (title !== undefined) {
        resolve([title, options.split("\n")])
        reject("error")
      }
    })
  })
}
module.exports = {
  findTable,
  totalDays,
  updateField,
  findRecord,
  findTitle,
  createRecord,
  updateName
}
