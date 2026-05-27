# PyMySQL avoids native mysqlclient compilation on Windows while exposing the MySQLdb API Django expects.
import pymysql

pymysql.install_as_MySQLdb()
