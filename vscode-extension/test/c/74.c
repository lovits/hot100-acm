#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

static int binary_search(int *nums, int len, int target)
{
    int low = -1;
    int high = len;
    while (low + 1 < high) {
        int mid = low + (high - low) / 2;
        if (target > nums[mid]) {
            low = mid;
        } else {
            high = mid;
        }
    }
    if (high == len || nums[high] != target) {
        return -high - 1;
    } else {
        return high;
    }
}

static bool searchMatrix(int** matrix, int matrixRowSize, int* matrixColSizes, int target)
{
    int matrixColSize=matrixColSizes[0];
    if (matrixRowSize == 0 || matrixColSize == 0) {
        return false;
    }

    if (target < matrix[0][0] || target > matrix[matrixRowSize - 1][matrixColSize - 1]) {
        return false;
    }

    int row = 0;
    int *nums = NULL;
    if (matrixRowSize > 0) {
        nums = malloc(matrixRowSize * sizeof(int));
        for (row = 0; row < matrixRowSize; row++) {
            nums[row] = matrix[row][0];
        }
        row = binary_search(nums, matrixRowSize, target);
        if (row >= 0) {
            return true;
        } else {
            row = -row - 1;
            if (row == 0) {
                return false;
            } else {
                row--;
            }
        }
    }
    int col = binary_search(matrix[row], matrixColSize, target);
    return col >= 0;
}
