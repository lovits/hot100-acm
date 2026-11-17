#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void dfs(char** grid, int row_size, int col_size, int row, int col)
{
    grid[row][col] = '0';

    if (row > 0 && grid[row - 1][col] == '1') {
        dfs(grid, row_size, col_size, row - 1, col);
    }

    if (row < row_size - 1 && grid[row + 1][col] == '1') {
        dfs(grid, row_size, col_size, row + 1, col);
    }

    if (col > 0 && grid[row][col - 1] == '1') {
        dfs(grid, row_size, col_size, row, col - 1);
    }

    if (col < col_size - 1 && grid[row][col + 1] == '1') {
        dfs(grid, row_size, col_size, row, col + 1);
    }
}

static int numIslands(char** grid, int gridRowSize, int* gridColSizes)
{
    int gridColSize=gridColSizes[0];
    int i, j, count = 0;
    for (i = 0; i < gridRowSize; i++) {
        for (j = 0; j < gridColSize; j++) {
            if (grid[i][j] == '1') {
                dfs(grid, gridRowSize, gridColSize, i, j);
                count++;
            }
        }
    }

    return count;
}
