// Dummy C++ file with intentional bugs for testing triangulated review

#include <iostream>
#include <string>

class DatabaseConnection {
private:
    std::string* connectionString;
    bool isConnected;

public:
    DatabaseConnection(const std::string& connStr) {
        connectionString = new std::string(connStr);
        isConnected = true;
    }

    // BUG 1: Missing destructor - memory leak!
    // Should have: ~DatabaseConnection() { delete connectionString; }

    void query(std::string sql) {
        // BUG 2: SQL injection vulnerability - no sanitization
        if (isConnected) {
            std::cout << "Executing: " << sql << std::endl;
        }
    }

    void disconnect() {
        isConnected = false;
        // BUG 3: connectionString not deleted, still leaking
    }
};

int main() {
    DatabaseConnection* db = new DatabaseConnection("server=localhost");

    // BUG 4: User input directly into SQL - injection risk
    std::string userInput;
    std::cin >> userInput;
    db->query("SELECT * FROM users WHERE name='" + userInput + "'");

    db->disconnect();
    // BUG 5: Memory leak - db never deleted

    return 0;
}
