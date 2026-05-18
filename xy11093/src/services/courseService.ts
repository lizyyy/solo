import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../database/db';
import { TrainingCourse } from '../types';

export async function createCourse(data: Omit<TrainingCourse, 'id'>): Promise<TrainingCourse> {
  const id = uuidv4();
  await run(
    `INSERT INTO training_courses (id, course_code, course_name, training_date, training_location, total_seats)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.courseCode, data.courseName, data.trainingDate, data.trainingLocation, data.totalSeats]
  );
  return getCourseById(id) as Promise<TrainingCourse>;
}

export async function getCourseById(id: string): Promise<TrainingCourse | undefined> {
  return get(
    `SELECT id, course_code as courseCode, course_name as courseName,
            training_date as trainingDate, training_location as trainingLocation,
            total_seats as totalSeats
     FROM training_courses WHERE id = ?`,
    [id]
  );
}

export async function getCourseByCode(courseCode: string): Promise<TrainingCourse | undefined> {
  return get(
    `SELECT id, course_code as courseCode, course_name as courseName,
            training_date as trainingDate, training_location as trainingLocation,
            total_seats as totalSeats
     FROM training_courses WHERE course_code = ?`,
    [courseCode]
  );
}

export async function getAllCourses(): Promise<TrainingCourse[]> {
  return all(
    `SELECT id, course_code as courseCode, course_name as courseName,
            training_date as trainingDate, training_location as trainingLocation,
            total_seats as totalSeats
     FROM training_courses`
  );
}
