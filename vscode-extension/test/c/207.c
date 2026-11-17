#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>


struct graph_node {
    int req_num;
    int reqs[15];
    bool touched;
    bool taken;
};

static bool dfs(struct graph_node *courses, int id)
{
    int i;
    if (courses[id].touched) {
        return true;
    } else if (courses[id].taken) {
        return false;
    } else {
        courses[id].taken = true;
        for (i = 0; i < courses[id].req_num; i++) {
            if (!dfs(courses, courses[id].reqs[i])) {
                return false;
            }
        }
        /* If paths overlapped, mark in backtracing for no need to traverse next time */
        courses[id].touched = true;
        courses[id].taken = false;
        return true;
    }
}

static bool canFinish(int numCourses, int** prerequisites, int prerequisitesSize, int *prerequisitesColSize)
{
    int i;
    struct graph_node *courses = malloc(numCourses * sizeof(*courses));

    memset(courses, 0, numCourses * sizeof(*courses));
    for (i = 0; i < prerequisitesSize; i++) {
        int id = prerequisites[i][0];
        int req = prerequisites[i][1];
        courses[id].reqs[courses[id].req_num++] = req;
    }

    for (i = 0; i < numCourses; i++) {
        if (!dfs(courses, i)) {
            return false;
        }
    }

    return true;
}
