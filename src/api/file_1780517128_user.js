function getUser(userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  return db.query(query); // SQL injection vulnerability
}
